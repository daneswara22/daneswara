"""Custom orders with deposit (Draft -> Proses -> Selesai)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Customer, Order, Purchase, Sale
from ..schemas import CustomOrderInput, OrderDepositInput, SettleOrderInput, UpdateOrderInput
from ..security import get_current_user, log_activity, require_roles
from ..utils import doc_number, rp, utcnow
from .sales import decrement_stock, next_invoice

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("")
async def list_orders(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    orders = (await db.execute(select(Order).where(Order.tenant_id == tid).order_by(Order.created_at.desc()).limit(500))).scalars().all()
    pos = (await db.execute(select(Purchase.order_id, Purchase.po_number).where(Purchase.tenant_id == tid, Purchase.order_id.is_not(None)))).all()
    po_map: dict = {}
    for oid, num in pos:
        po_map.setdefault(oid, []).append(num)
    out = []
    for o in orders:
        d = o.to_dict()
        nums = po_map.get(o.id, [])
        d["po_created"] = len(nums) > 0
        d["po_numbers"] = nums
        out.append(d)
    return out


@router.post("")
async def create_order(data: CustomOrderInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Item pesanan kosong")
    tid = user["tenant_id"]
    items = [i.model_dump() for i in data.items]
    subtotal = sum(i["price"] * i["qty"] for i in items)
    taxed = (subtotal - data.discount) * (data.tax_rate / 100)
    total = subtotal - data.discount + taxed
    cust_name = data.customer_name
    if data.customer_id:
        c = (await db.execute(select(Customer).where(Customer.id == data.customer_id, Customer.tenant_id == tid))).scalar_one_or_none()
        if c:
            cust_name = c.name
    count = (await db.execute(select(func.count()).select_from(Order).where(Order.tenant_id == tid))).scalar_one()
    is_draft = (data.deposit_amount or 0) <= 0
    o = Order(
        tenant_id=tid, order_number=doc_number("ORD", count), customer_id=data.customer_id, customer_name=cust_name or "", items=items,
        subtotal=subtotal, discount=data.discount, tax_rate=data.tax_rate, tax=taxed, total=total, deposit_amount=data.deposit_amount,
        deposit_method=data.deposit_method, remaining=max(0, total - data.deposit_amount), note=data.note or "", order_type=data.order_type or "Reguler",
        channel=(data.channel or "Toko").strip() or "Toko", status="Draft" if is_draft else "Proses", cashier=user.get("name", ""),
    )
    db.add(o)
    if is_draft:
        await log_activity(db, tid, user, "Draft Pesanan", f"{o.order_number} ({o.order_type}) — belum bayar")
    else:
        await log_activity(db, tid, user, "Pesanan Custom + Deposit", f"{o.order_number} DP {rp(data.deposit_amount)}")
    await db.commit()
    return o.to_dict()


async def _get_order(db: AsyncSession, oid: str, tid: str) -> Order:
    o = (await db.execute(select(Order).where(Order.id == oid, Order.tenant_id == tid))).scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    return o


@router.post("/{oid}/deposit")
async def add_order_deposit(oid: str, data: OrderDepositInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    order = await _get_order(db, oid, user["tenant_id"])
    if order.status == "Selesai":
        raise HTTPException(status_code=400, detail="Pesanan sudah selesai")
    if data.deposit_amount <= 0:
        raise HTTPException(status_code=400, detail="Nominal DP harus lebih dari 0")
    if data.deposit_amount > order.total:
        raise HTTPException(status_code=400, detail="Nominal DP melebihi total pesanan")
    order.deposit_amount = data.deposit_amount
    order.deposit_method = data.deposit_method
    order.remaining = max(0, order.total - data.deposit_amount)
    order.status = "Proses"
    await log_activity(db, user["tenant_id"], user, "DP Pesanan", f"{order.order_number} DP {rp(data.deposit_amount)}")
    await db.commit()
    return order.to_dict()


@router.post("/{oid}/complete")
async def complete_order(oid: str, data: SettleOrderInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    order = await _get_order(db, oid, tid)
    if order.status == "Selesai":
        raise HTTPException(status_code=400, detail="Pesanan sudah selesai")
    remaining = max(0, order.total - (order.deposit_amount or 0))
    if data.paid_amount < remaining:
        raise HTTPException(status_code=400, detail="Nominal pelunasan kurang dari sisa tagihan")
    items = order.items or []
    await decrement_stock(db, tid, user, items, f"Pesanan {order.order_number}")
    total_cost = sum(i.get("cost", 0) * i.get("qty", 0) for i in items)
    invoice = await next_invoice(db, tid)
    if order.customer_id:
        c = (await db.execute(select(Customer).where(Customer.id == order.customer_id))).scalar_one_or_none()
        if c:
            c.total_spent = (c.total_spent or 0) + order.total
            c.visits = (c.visits or 0) + 1
    paid_total = data.paid_amount + (order.deposit_amount or 0)
    sale = Sale(
        tenant_id=tid, invoice=invoice, items=items, subtotal=order.subtotal, discount=order.discount, tax_rate=order.tax_rate, tax=order.tax,
        total=order.total, cost=total_cost, profit=(order.subtotal - order.discount) - total_cost, payment_method=data.payment_method,
        paid_amount=paid_total, change=max(0, paid_total - order.total), customer_name=order.customer_name or "", customer_id=order.customer_id,
        from_order=order.order_number, channel=order.channel or "Toko", cashier=user.get("name", ""), cashier_id=user["id"],
    )
    db.add(sale)
    order.status = "Selesai"
    order.completed_at = utcnow()
    order.invoice = invoice
    order.payment_method = data.payment_method
    order.settle_paid = data.paid_amount
    order.remaining = 0
    await log_activity(db, tid, user, "Pesanan Selesai", f"{order.order_number} -> {invoice}")
    await db.commit()
    return sale.to_dict()


@router.put("/{oid}")
async def update_order(oid: str, data: UpdateOrderInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    order = await _get_order(db, oid, user["tenant_id"])
    if order.status != "Draft":
        raise HTTPException(status_code=400, detail="Hanya draft (belum bayar) yang bisa diubah")
    if not data.items:
        raise HTTPException(status_code=400, detail="Item pesanan kosong")
    items = [i.model_dump() for i in data.items]
    subtotal = sum(i["price"] * i["qty"] for i in items)
    taxed = (subtotal - data.discount) * (data.tax_rate / 100)
    total = subtotal - data.discount + taxed
    order.items = items
    order.subtotal, order.discount, order.tax_rate, order.tax, order.total, order.remaining = subtotal, data.discount, data.tax_rate, taxed, total, total
    order.customer_name = data.customer_name or order.customer_name or ""
    order.order_type = data.order_type or "Reguler"
    await log_activity(db, user["tenant_id"], user, "Draft Pesanan Diubah", order.order_number)
    await db.commit()
    return order.to_dict()


@router.delete("/{oid}")
async def delete_order(oid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    o = (await db.execute(select(Order).where(Order.id == oid, Order.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if o:
        await db.delete(o)
        await db.commit()
    return {"ok": True}
