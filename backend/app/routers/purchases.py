"""Purchase orders (restock) + suppliers."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Order, Product, Purchase, StockMovement, Supplier
from ..schemas import PurchaseOrderInput, SupplierInput, SupplierRef
from ..security import get_current_user, log_activity, require_roles
from ..utils import doc_number, rp, utcnow

router = APIRouter(tags=["purchases"])


# ---------- Suppliers ----------
@router.get("/suppliers")
async def list_suppliers(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Supplier).where(Supplier.tenant_id == user["tenant_id"]).order_by(Supplier.created_at.desc()))).scalars().all()
    return [s.to_dict() for s in rows]


@router.post("/suppliers")
async def create_supplier(data: SupplierInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    s = Supplier(tenant_id=user["tenant_id"], **data.model_dump())
    db.add(s)
    await db.commit()
    return s.to_dict()


@router.put("/suppliers/{sid}")
async def update_supplier(sid: str, data: SupplierInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Supplier).where(Supplier.id == sid, Supplier.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier tidak ditemukan")
    for k, v in data.model_dump().items():
        setattr(s, k, v)
    await db.commit()
    return {"ok": True}


@router.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(Supplier).where(Supplier.id == sid, Supplier.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if s:
        await db.delete(s)
        await db.commit()
    return {"ok": True}


# ---------- Purchase orders ----------
async def resolve_supplier(db: AsyncSession, supplier_id, user: dict):
    if not supplier_id:
        raise HTTPException(status_code=400, detail="Supplier wajib dipilih")
    sup = (await db.execute(select(Supplier).where(Supplier.id == supplier_id, Supplier.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if not sup:
        raise HTTPException(status_code=400, detail="Supplier tidak ditemukan")
    name = (sup.name or "").strip()
    if not name or name == "-":
        raise HTTPException(status_code=400, detail="Nama supplier tidak valid (tidak boleh kosong atau '-')")
    return supplier_id, name


async def next_po_number(db: AsyncSession, tid: str) -> str:
    count = (await db.execute(select(func.count()).select_from(Purchase).where(Purchase.tenant_id == tid))).scalar_one()
    return doc_number("PO", count)


@router.get("/purchases")
async def list_purchases(user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Purchase).where(Purchase.tenant_id == user["tenant_id"]).order_by(Purchase.created_at.desc()).limit(1000))).scalars().all()
    return [p.to_dict() for p in rows]


@router.post("/purchases")
async def create_purchase(data: PurchaseOrderInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Item pembelian kosong")
    tid = user["tenant_id"]
    supplier_id, supplier_name = await resolve_supplier(db, data.supplier_id, user)
    items = [i.model_dump() for i in data.items]
    total = sum(i["qty"] * i["cost"] for i in items)
    po = Purchase(tenant_id=tid, po_number=await next_po_number(db, tid), supplier_id=supplier_id, supplier_name=supplier_name, items=items,
                  total=total, note=data.note or "", customer_name="", status="Menunggu", cashier=user.get("name", ""))
    db.add(po)
    await log_activity(db, tid, user, "Buat PO", f"{po.po_number} - {rp(total)}")
    await db.commit()
    return po.to_dict()


@router.post("/purchases/from-order/{oid}")
async def create_purchase_from_order(oid: str, ref: SupplierRef, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    order = (await db.execute(select(Order).where(Order.id == oid, Order.tenant_id == tid))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if not order.items:
        raise HTTPException(status_code=400, detail="Pesanan tidak memiliki item")
    supplier_id, supplier_name = await resolve_supplier(db, ref.supplier_id, user)
    items = []
    for it in order.items:
        prod = (await db.execute(select(Product).where(Product.id == it.get("product_id"), Product.tenant_id == tid))).scalar_one_or_none()
        cost = prod.cost if prod else it.get("cost", 0)
        items.append({"product_id": it.get("product_id"), "name": it.get("name"), "qty": it.get("qty"), "cost": cost})
    total = sum(i["qty"] * i["cost"] for i in items)
    po = Purchase(tenant_id=tid, po_number=await next_po_number(db, tid), supplier_id=supplier_id, supplier_name=supplier_name, items=items, total=total,
                  note=f"Dari pesanan {order.order_number}", customer_name=order.customer_name or "", order_id=oid, order_number=order.order_number,
                  status="Menunggu", cashier=user.get("name", ""))
    db.add(po)
    await log_activity(db, tid, user, "Buat PO dari Pesanan", f"{po.po_number} <- {order.order_number}")
    await db.commit()
    return po.to_dict()


@router.post("/purchases/from-product/{pid}")
async def create_purchase_from_product(pid: str, ref: SupplierRef, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    prod = (await db.execute(select(Product).where(Product.id == pid, Product.tenant_id == tid))).scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    supplier_id, supplier_name = await resolve_supplier(db, ref.supplier_id, user)
    stock = prod.stock or 0
    qty = -stock if stock < 0 else 1
    cost = prod.cost or 0
    items = [{"product_id": pid, "name": prod.name, "qty": qty, "cost": cost}]
    po = Purchase(tenant_id=tid, po_number=await next_po_number(db, tid), supplier_id=supplier_id, supplier_name=supplier_name, items=items,
                  total=qty * cost, note="Restok stok minus", customer_name="", status="Menunggu", cashier=user.get("name", ""))
    db.add(po)
    await log_activity(db, tid, user, "Buat PO Restok", f"{po.po_number} - {prod.name} x{qty}")
    await db.commit()
    return po.to_dict()


async def _get_po(db: AsyncSession, pid: str, tid: str) -> Purchase:
    po = (await db.execute(select(Purchase).where(Purchase.id == pid, Purchase.tenant_id == tid))).scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="PO tidak ditemukan")
    return po


@router.put("/purchases/{pid}")
async def update_purchase(pid: str, data: PurchaseOrderInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    po = await _get_po(db, pid, user["tenant_id"])
    if po.status == "Diterima":
        raise HTTPException(status_code=400, detail="PO yang sudah diterima tidak dapat diubah")
    if not data.items:
        raise HTTPException(status_code=400, detail="Item pembelian kosong")
    supplier_id, supplier_name = await resolve_supplier(db, data.supplier_id, user)
    items = [i.model_dump() for i in data.items]
    po.supplier_id, po.supplier_name, po.items, po.total, po.note = supplier_id, supplier_name, items, sum(i["qty"] * i["cost"] for i in items), data.note or ""
    await log_activity(db, user["tenant_id"], user, "Ubah PO", f"{po.po_number} - {rp(po.total)}")
    await db.commit()
    return {"ok": True}


@router.delete("/purchases/{pid}")
async def delete_purchase(pid: str, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    po = await _get_po(db, pid, tid)
    if po.status == "Diterima":
        if user.get("role") != "Owner":
            raise HTTPException(status_code=403, detail="Hanya Owner yang dapat menghapus PO yang sudah diterima")
        for i in po.items or []:
            prod = (await db.execute(select(Product).where(Product.id == i.get("product_id"), Product.tenant_id == tid))).scalar_one_or_none()
            if prod:
                before = prod.stock or 0
                after = before - int(i.get("qty", 0))
                prod.stock = after
                db.add(StockMovement(tenant_id=tid, product_id=prod.id, product_name=i.get("name", ""), type="Keluar", qty=int(i.get("qty", 0)),
                                     before=before, after=after, note=f"Pembatalan PO {po.po_number}", user_name=user.get("name", "")))
        await db.delete(po)
        await log_activity(db, tid, user, "Hapus PO (Diterima)", f"{po.po_number} - stok dikoreksi")
        await db.commit()
        return {"ok": True, "reversed": True}
    await db.delete(po)
    await log_activity(db, tid, user, "Hapus PO", po.po_number)
    await db.commit()
    return {"ok": True}


@router.post("/purchases/{pid}/receive")
async def receive_purchase(pid: str, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    po = await _get_po(db, pid, tid)
    if po.status == "Diterima":
        raise HTTPException(status_code=400, detail="PO sudah diterima")
    for i in po.items or []:
        prod = (await db.execute(select(Product).where(Product.id == i.get("product_id"), Product.tenant_id == tid))).scalar_one_or_none()
        if prod:
            before = prod.stock or 0
            after = before + int(i.get("qty", 0))
            prod.stock = after
            prod.cost = i.get("cost", prod.cost or 0)
            db.add(StockMovement(tenant_id=tid, product_id=prod.id, product_name=i.get("name", ""), type="Masuk", qty=int(i.get("qty", 0)),
                                 before=before, after=after, note=f"Penerimaan {po.po_number}", user_name=user.get("name", "")))
    po.status = "Diterima"
    po.received_at = utcnow()
    await log_activity(db, tid, user, "Terima Barang", po.po_number)
    await db.commit()
    return {"ok": True}
