"""Categories, products, inventory (stock movements)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Category, Product, Purchase, StockMovement
from ..schemas import CategoryInput, ProductInput, ReorderInput, StockInput
from ..security import get_current_user, log_activity, require_roles
from ..storage import storage

router = APIRouter(tags=["catalog"])


def _sort_key(row: dict):
    so = row.get("sort_order")
    return (so if so is not None else 10**9, (row.get("name") or "").lower())


# ---------- Categories ----------
@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Category).where(Category.tenant_id == user["tenant_id"]))).scalars().all()
    out = [c.to_dict() for c in rows]
    out.sort(key=_sort_key)
    return out


@router.post("/categories")
async def create_category(data: CategoryInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    count = (await db.execute(select(func.count()).select_from(Category).where(Category.tenant_id == user["tenant_id"]))).scalar_one()
    image = await storage.normalize_image_field(data.image or "", "category")
    c = Category(tenant_id=user["tenant_id"], name=data.name, color=data.color, image=image or "", sort_order=count)
    db.add(c)
    await db.commit()
    return c.to_dict()


@router.post("/categories/reorder")
async def reorder_categories(data: ReorderInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Category).where(Category.tenant_id == user["tenant_id"], Category.id.in_(data.ids)))).scalars().all()
    by_id = {r.id: r for r in rows}
    for idx, cid in enumerate(data.ids):
        if cid in by_id:
            by_id[cid].sort_order = idx
    await log_activity(db, user["tenant_id"], user, "Atur Urutan Kategori", f"{len(data.ids)} kategori diurutkan ulang")
    await db.commit()
    return {"ok": True, "count": len(data.ids)}


@router.put("/categories/{cid}")
async def update_category(cid: str, data: CategoryInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Category).where(Category.id == cid, Category.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    new_image = await storage.normalize_image_field(data.image or "", "category")
    if c.image and new_image != c.image:
        await storage.delete(c.image)
    c.name, c.color, c.image = data.name, data.color, new_image or ""
    await db.commit()
    return {"ok": True}


@router.delete("/categories/{cid}")
async def delete_category(cid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Category).where(Category.id == cid, Category.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if c:
        await storage.delete(c.image)
        await db.delete(c)
        await db.commit()
    return {"ok": True}


# ---------- Products ----------
@router.get("/products")
async def list_products(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    prods = (await db.execute(select(Product).where(Product.tenant_id == tid))).scalars().all()
    open_pos = (await db.execute(select(Purchase.po_number, Purchase.items).where(Purchase.tenant_id == tid, Purchase.status == "Menunggu"))).all()
    po_map: dict = {}
    for po_number, items in open_pos:
        for it in items or []:
            po_map.setdefault(it.get("product_id"), []).append(po_number)
    out = []
    for p in prods:
        d = p.to_dict()
        nums = po_map.get(p.id, [])
        d["open_po"] = len(nums) > 0
        d["open_po_numbers"] = nums
        out.append(d)
    out.sort(key=_sort_key)
    return out


@router.post("/products/reorder")
async def reorder_products(data: ReorderInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Product).where(Product.tenant_id == user["tenant_id"], Product.id.in_(data.ids)))).scalars().all()
    by_id = {r.id: r for r in rows}
    for idx, pid in enumerate(data.ids):
        if pid in by_id:
            by_id[pid].sort_order = idx
    await log_activity(db, user["tenant_id"], user, "Atur Urutan Produk", f"{len(data.ids)} produk diurutkan ulang")
    await db.commit()
    return {"ok": True, "count": len(data.ids)}


@router.post("/products")
async def create_product(data: ProductInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    count = (await db.execute(select(func.count()).select_from(Product).where(Product.tenant_id == user["tenant_id"]))).scalar_one()
    payload = data.model_dump()
    payload["image"] = await storage.normalize_image_field(payload.get("image") or "", "product") or ""
    p = Product(tenant_id=user["tenant_id"], sort_order=count, **payload)
    db.add(p)
    await log_activity(db, user["tenant_id"], user, "Tambah Produk", data.name)
    await db.commit()
    return p.to_dict()


@router.put("/products/{pid}")
async def update_product(pid: str, data: ProductInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(Product).where(Product.id == pid, Product.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    payload = data.model_dump()
    payload["image"] = await storage.normalize_image_field(payload.get("image") or "", "product") or ""
    if p.image and payload["image"] != p.image:
        await storage.delete(p.image)
    for k, v in payload.items():
        setattr(p, k, v)
    await db.commit()
    return {"ok": True}


@router.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(Product).where(Product.id == pid, Product.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if p:
        await storage.delete(p.image)
        await db.delete(p)
        await db.commit()
    return {"ok": True}


# ---------- Inventory ----------
@router.post("/stock")
async def adjust_stock(data: StockInput, user: dict = Depends(require_roles("Owner", "Manager", "Gudang")), db: AsyncSession = Depends(get_db)):
    product = (await db.execute(select(Product).where(Product.id == data.product_id, Product.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    before = product.stock or 0
    if data.type == "Masuk":
        after = before + data.qty
    elif data.type == "Keluar":
        after = before - data.qty
    elif data.type == "Opname":
        after = data.qty
    else:
        after = before + data.qty
    product.stock = after
    mv = StockMovement(tenant_id=user["tenant_id"], product_id=product.id, product_name=product.name, type=data.type, qty=data.qty,
                       before=before, after=after, note=data.note or "", user_name=user.get("name", ""))
    db.add(mv)
    await log_activity(db, user["tenant_id"], user, f"Stok {data.type}", f"{product.name}: {before} -> {after}")
    await db.commit()
    return mv.to_dict()


@router.get("/stock/movements")
async def stock_movements(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(StockMovement).where(StockMovement.tenant_id == user["tenant_id"]).order_by(StockMovement.created_at.desc()).limit(500))).scalars().all()
    return [m.to_dict() for m in rows]
