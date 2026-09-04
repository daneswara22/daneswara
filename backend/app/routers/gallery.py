"""Website gallery: public read for the landing page, CRUD + reorder from the POS dashboard."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import GalleryItem, User
from ..schemas import GalleryInput, ReorderInput
from ..security import get_current_user, log_activity, require_roles
from ..storage import storage

router = APIRouter(tags=["gallery"])


def _serialize(g: GalleryItem) -> dict:
    return {"id": g.id, "src": g.src, "label": g.label, "tag": g.tag or "", "span": g.span or "", "sort_order": g.sort_order or 0,
            "created_at": g.to_dict()["created_at"]}


@router.get("/public/gallery")
async def public_gallery(db: AsyncSession = Depends(get_db)):
    """Public endpoint consumed by the landing page (no auth). Single-tenant: returns all items."""
    rows = (await db.execute(select(GalleryItem).order_by(GalleryItem.sort_order.desc(), GalleryItem.created_at.desc()))).scalars().all()
    return [{"id": g.id, "src": g.src, "label": g.label, "tag": g.tag or "", "span": g.span or "", "sort_order": g.sort_order or 0} for g in rows]


@router.get("/gallery")
async def list_gallery(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(GalleryItem).where(GalleryItem.tenant_id == user["tenant_id"]).order_by(GalleryItem.sort_order.desc(), GalleryItem.created_at.desc()))).scalars().all()
    return [_serialize(g) for g in rows]


@router.post("/gallery")
async def create_gallery(data: GalleryInput, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    if not data.src.strip() or not data.label.strip():
        raise HTTPException(status_code=400, detail="Gambar dan label wajib diisi")
    src = await storage.normalize_image_field(data.src.strip(), "gallery")
    if data.sort_order in (None, 0):
        top = (await db.execute(select(GalleryItem.sort_order).where(GalleryItem.tenant_id == user["tenant_id"]).order_by(GalleryItem.sort_order.desc()).limit(1))).scalar_one_or_none()
        data.sort_order = (top or 0) + 1
    g = GalleryItem(tenant_id=user["tenant_id"], src=src, label=data.label.strip(), tag=(data.tag or "").strip(), span=data.span or "", sort_order=int(data.sort_order or 0))
    db.add(g)
    await log_activity(db, user["tenant_id"], user, "Tambah Foto Galeri", g.label)
    await db.commit()
    return _serialize(g)


@router.post("/gallery/reorder")
async def reorder_gallery(data: ReorderInput, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(GalleryItem).where(GalleryItem.tenant_id == user["tenant_id"], GalleryItem.id.in_(data.ids)))).scalars().all()
    by_id = {r.id: r for r in rows}
    n = len(data.ids)
    for idx, gid in enumerate(data.ids):  # first in list = shown first = highest sort_order
        if gid in by_id:
            by_id[gid].sort_order = n - idx
    await db.commit()
    return {"ok": True, "count": n}


@router.put("/gallery/{gid}")
async def update_gallery(gid: str, data: GalleryInput, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(GalleryItem).where(GalleryItem.id == gid, GalleryItem.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Foto tidak ditemukan")
    if not data.src.strip() or not data.label.strip():
        raise HTTPException(status_code=400, detail="Gambar dan label wajib diisi")
    src = await storage.normalize_image_field(data.src.strip(), "gallery")
    if g.src and src != g.src:
        await storage.delete(g.src)
    g.src, g.label, g.tag, g.span, g.sort_order = src, data.label.strip(), (data.tag or "").strip(), data.span or "", int(data.sort_order or 0)
    await db.commit()
    return _serialize(g)


@router.delete("/gallery/{gid}")
async def delete_gallery(gid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(GalleryItem).where(GalleryItem.id == gid, GalleryItem.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if g:
        await storage.delete(g.src)
        await log_activity(db, user["tenant_id"], user, "Hapus Foto Galeri", g.label)
        await db.delete(g)
        await db.commit()
    return {"ok": True}
