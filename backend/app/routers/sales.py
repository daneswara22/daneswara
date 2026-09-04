"""Sales (POS checkout, refund) + held orders."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Customer, HeldOrder, Product, Sale, StockMovement
from ..schemas import HeldOrderInput, SaleInput
from ..security import get_current_user, log_activity, require_roles
from ..utils import doc_number, rp, utcnow

router = APIRouter(tags=["sales"])


async def next_invoice(db: AsyncSession, tid: str) -> str:
    count = (await db.execute(select(func.count()).select_from(Sale).where(Sale.tenant_id == tid))).scalar_one()
    return doc_number("INV", count)


async def decrement_stock(db: AsyncSession, tid: str, user: dict, items: list, note: str) -> None:
    for i in items:
        pid = i.get("product_id")
        prod = (await db.execute(select(Product).where(Product.id == pid, Product.tenant_id == tid))).scalar_one_or_none()
        if not prod:
            continue
        before = prod.stock or 0
        after = before - int(i.get("qty", 0))
        prod.stock = after
        db.add(StockMovement(tenant_id=tid, product_id=pid, product_name=i.get("name", ""), type="Keluar", qty=int(i.get("qty", 0)),
                             before=before, after=after, note=note, user_name=user.get("name", "")))


@router.post("/sales")
async def create_sale(data: SaleInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Keranjang kosong")
    tid = user["tenant_id"]
    items = [i.model_dump() for i in data.items]
    subtotal = sum(i["price"] * i["qty"] for i in items)
    total_cost = sum(i["cost"] * i["qty"] for i in items)
    taxed = (subtotal - data.discount) * (data.tax_rate / 100)
    total = subtotal - data.discount + taxed
    await decrement_stock(db, tid, user, items, "Penjualan POS")
    invoice = await next_invoice(db, tid)
    cust_name, cust_phone = data.customer_name, ""
    if data.customer_id:
        cust = (await db.execute(select(Customer).where(Customer.id == data.customer_id, Customer.tenant_id == tid))).scalar_one_or_none()
        if cust:
            cust_name = cust.name
            cust_phone = cust.phone or ""
            cust.total_spent = (cust.total_spent or 0) + total
            cust.visits = (cust.visits or 0) + 1
    sale = Sale(
        tenant_id=tid, invoice=invoice, items=items, subtotal=subtotal, discount=data.discount, tax_rate=data.tax_rate, tax=taxed,
        total=total, cost=total_cost, profit=(subtotal - data.discount) - total_cost, payment_method=data.payment_method,
        paid_amount=data.paid_amount, change=max(0, data.paid_amount - total), customer_name=cust_name or "", customer_id=data.customer_id,
        customer_phone=cust_phone, channel=(data.channel or "Toko").strip() or "Toko", cashier=user.get("name", ""), cashier_id=user["id"],
    )
    db.add(sale)
    await log_activity(db, tid, user, "Transaksi Penjualan", f"{invoice} - {rp(total)}")
    await db.commit()
    return sale.to_dict()


@router.get("/sales")
async def list_sales(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db), limit: int = Query(100, le=5000)):
    rows = (await db.execute(select(Sale).where(Sale.tenant_id == user["tenant_id"]).order_by(Sale.created_at.desc()).limit(limit))).scalars().all()
    return [s.to_dict() for s in rows]


@router.post("/sales/{sid}/refund")
async def refund_sale(sid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    sale = (await db.execute(select(Sale).where(Sale.id == sid, Sale.tenant_id == tid))).scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if sale.refunded:
        raise HTTPException(status_code=400, detail="Transaksi sudah di-refund")
    for i in sale.items or []:
        prod = (await db.execute(select(Product).where(Product.id == i.get("product_id"), Product.tenant_id == tid))).scalar_one_or_none()
        if prod:
            prod.stock = (prod.stock or 0) + int(i.get("qty", 0))
    sale.refunded = True
    sale.refunded_at = utcnow()
    await log_activity(db, tid, user, "Refund", sale.invoice)
    await db.commit()
    return {"ok": True}


# ---------- Held orders ----------
@router.get("/held-orders")
async def list_held(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(HeldOrder).where(HeldOrder.tenant_id == user["tenant_id"]).order_by(HeldOrder.created_at.desc()).limit(200))).scalars().all()
    return [h.to_dict() for h in rows]


@router.post("/held-orders")
async def create_held(data: HeldOrderInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    h = HeldOrder(tenant_id=user["tenant_id"], label=data.label, items=[i.model_dump() for i in data.items], discount=data.discount, cashier=user.get("name", ""))
    db.add(h)
    await db.commit()
    return h.to_dict()


@router.delete("/held-orders/{hid}")
async def delete_held(hid: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    h = (await db.execute(select(HeldOrder).where(HeldOrder.id == hid, HeldOrder.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if h:
        await db.delete(h)
        await db.commit()
    return {"ok": True}
