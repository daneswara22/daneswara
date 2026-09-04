"""Idempotent startup seeding: tenant/owner, settings, catalog, customers, website gallery."""
import csv
import json
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .models import Category, Customer, GalleryItem, Product, Tenant, TenantSettings, User
from .security import hash_password
from .storage import storage
from .utils import new_id

logger = logging.getLogger(__name__)


async def _count(db: AsyncSession, model, tid: str) -> int:
    return (await db.execute(select(func.count()).select_from(model).where(model.tenant_id == tid))).scalar_one()


async def seed_owner(db: AsyncSession) -> User:
    uname = settings.OWNER_USERNAME.lower().strip()
    owner = (await db.execute(select(User).where(User.username == uname))).scalar_one_or_none()
    if owner:
        return owner
    old_owner = (await db.execute(select(User).where(User.role == "Owner").order_by(User.created_at))).scalars().first()
    if old_owner:
        old_owner.username = uname
        old_owner.password_hash = hash_password(settings.OWNER_PASSWORD)
        await db.commit()
        logger.info("Migrated super-admin to username '%s'", uname)
        return old_owner
    tenant = Tenant(id=new_id(), name=settings.OWNER_BUSINESS)
    db.add(tenant)
    owner = User(tenant_id=tenant.id, username=uname, password_hash=hash_password(settings.OWNER_PASSWORD), name=settings.OWNER_NAME, role="Owner", active=True)
    db.add(owner)
    db.add(TenantSettings(tenant_id=tenant.id, business_name=settings.OWNER_BUSINESS, address="Jl. Gunung Shangyang 156, Denpasar - Bali",
                          phone="+62 858 8810 2930", currency="Rp", tax_rate=0, receipt_footer="Terima kasih telah berbelanja!"))
    await db.commit()
    logger.info("Seeded owner account '%s'", uname)
    return owner


async def seed_customers(db: AsyncSession, tid: str) -> None:
    if not settings.SEED_CUSTOMERS or await _count(db, Customer, tid) > 0:
        return
    path = settings.DATA_DIR / "seed_customers.json"
    if not path.exists():
        return
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)
    n = 0
    for c in rows:
        if not c.get("name"):
            continue
        db.add(Customer(tenant_id=tid, name=c["name"], phone=c.get("phone", "") or "", email=c.get("email", "") or "", address=c.get("address", "") or "",
                        visits=int(c.get("visits", 0) or 0), total_spent=float(c.get("total_spent", 0) or 0)))
        n += 1
    await db.commit()
    logger.info("Seeded %d customers", n)


def _num(v) -> float:
    v = (v or "").strip().lower()
    if not v or v == "variable":
        return 0.0
    try:
        return float(v.replace(".", "").replace(",", ""))
    except ValueError:
        return 0.0


async def seed_catalog(db: AsyncSession, tid: str) -> None:
    """Loyverse-style export: Handle groups variants -> Category; each variant row -> Product."""
    if not settings.SEED_CATALOG or await _count(db, Product, tid) > 0 or await _count(db, Category, tid) > 0:
        return
    path = settings.DATA_DIR / "export_items.csv"
    if not path.exists():
        return
    palette = ["#2563EB", "#7C3AED", "#F97316", "#10B981", "#EF4444", "#0EA5E9"]
    cats: dict = {}
    products = 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            handle = (row.get("Handle") or "").strip()
            sku = (row.get("SKU") or "").strip()
            if not handle and not sku:
                continue
            name = (row.get("Name") or "").strip()
            if handle not in cats:
                cname = name or handle.replace("-", " ").upper()
                cat = Category(tenant_id=tid, name=cname, color=palette[len(cats) % len(palette)], image="", sort_order=len(cats))
                db.add(cat)
                cats[handle] = cat
            cat = cats[handle]
            variant = (row.get("Option 1 value") or "").strip()
            pname = f"{cat.name} {variant}".strip() if variant else (name or cat.name)
            db.add(Product(tenant_id=tid, name=pname, sku=sku, barcode=(row.get("Barcode") or "").strip(), category_id=cat.id,
                           price=_num(row.get("Price [DANESWARA PRINTING]")), cost=_num(row.get("Cost")), stock=0, min_stock=5, unit="pcs",
                           image="", description=(row.get("Description") or "").strip(), active=True, sort_order=products))
            products += 1
    await db.commit()
    logger.info("Seeded catalog: %d categories, %d products", len(cats), products)


async def seed_gallery(db: AsyncSession, tid: str) -> None:
    if not settings.SEED_GALLERY or await _count(db, GalleryItem, tid) > 0:
        return
    path = settings.DATA_DIR / "gallery_seed.json"
    if not path.exists():
        return
    with open(path, encoding="utf-8") as f:
        items = json.load(f)
    n = 0
    for it in items:
        src = (it.get("src") or "").strip()
        if not src:
            continue
        if src.startswith("data:image"):
            try:
                src = await storage.upload_data_uri(src, "gallery") or ""
            except Exception as e:
                logger.warning("gallery seed image failed: %s", e)
                continue
            if not src:
                continue
        db.add(GalleryItem(tenant_id=tid, src=src, label=it.get("label", "") or "", tag=it.get("tag", "") or "", span=it.get("span", "") or "",
                           sort_order=int(it.get("sort_order", 0) or 0)))
        n += 1
    await db.commit()
    logger.info("Seeded %d gallery items (storage=%s)", n, storage.backend)


async def run_seed(db: AsyncSession) -> None:
    owner = await seed_owner(db)
    tid = owner.tenant_id
    await seed_catalog(db, tid)
    await seed_customers(db, tid)
    await seed_gallery(db, tid)
