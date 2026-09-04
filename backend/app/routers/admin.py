"""Owner tools: reset transactions, reprice from catalog CSV, reset stock, CSV export."""
import csv
import io
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..models import (Activity, Category, Customer, Expense, HeldOrder, Order, OtherIncome, Product, Purchase, Sale, StockMovement, Supplier, User)
from ..security import log_activity, require_roles
from ..utils import local_range_to_utc, local_today, parse_date

router = APIRouter(tags=["admin"])


@router.post("/admin/clear-transactions")
async def clear_transactions(user: dict = Depends(require_roles("Owner")), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    result = {}
    for name, model in (("sales", Sale), ("orders", Order), ("held_orders", HeldOrder), ("activities", Activity),
                        ("stock_movements", StockMovement), ("expenses", Expense), ("other_income", OtherIncome)):
        r = await db.execute(delete(model).where(model.tenant_id == tid))
        result[name] = r.rowcount
    await log_activity(db, tid, user, "Reset Data Transaksi", "Semua transaksi percobaan dihapus")
    await db.commit()
    return {"ok": True, "deleted": result}


def parse_catalog_num(v) -> float:
    v = (v or "").strip().lower()
    if not v or v == "variable":
        return 0.0
    try:
        return float(v.replace(".", "").replace(",", ""))
    except ValueError:
        return 0.0


@router.post("/admin/reprice-catalog")
async def reprice_catalog(user: dict = Depends(require_roles("Owner")), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    csv_path = settings.DATA_DIR / "export_items.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=400, detail="File katalog tidak ditemukan di server")
    price_map = {}
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            sku = (row.get("SKU") or "").strip()
            if sku:
                price_map[sku] = {"price": parse_catalog_num(row.get("Price [DANESWARA PRINTING]")), "cost": parse_catalog_num(row.get("Cost"))}
    products = (await db.execute(select(Product).where(Product.tenant_id == tid))).scalars().all()
    matched, unmatched = 0, []
    for p in products:
        m = price_map.get((p.sku or "").strip())
        if m:
            matched += 1
            p.price, p.cost = m["price"], m["cost"]
        else:
            unmatched.append(p.name or p.sku or "?")
    await log_activity(db, tid, user, "Cocokkan Katalog", f"{matched} produk diperbarui harga & biaya dari katalog")
    await db.commit()
    return {"ok": True, "catalog_rows": len(price_map), "products": len(products), "matched": matched, "unmatched_count": len(unmatched), "unmatched": unmatched[:30]}


@router.post("/admin/reset-stock")
async def reset_stock(user: dict = Depends(require_roles("Owner")), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    r = await db.execute(update(Product).where(Product.tenant_id == tid).values(stock=0))
    await log_activity(db, tid, user, "Reset Stok", f"Stok {r.rowcount} produk di-reset ke 0")
    await db.commit()
    return {"ok": True, "reset": r.rowcount}


# ---------- CSV export ----------
EXPORT_MODELS = {
    "sales": Sale, "orders": Order, "purchases": Purchase, "expenses": Expense, "other_income": OtherIncome,
    "stock_movements": StockMovement, "products": Product, "categories": Category, "customers": Customer,
    "suppliers": Supplier, "users": User, "activities": Activity,
}
EXPORT_DATE_FILTERABLE = {"sales", "orders", "purchases", "stock_movements", "activities"}
EXPORT_DATEFIELD_FILTERABLE = {"expenses", "other_income"}


def _csv_cell(v):
    if v is None:
        return ""
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, bool):
        return "true" if v else "false"
    s = str(v)
    return "[gambar tersimpan]" if s.startswith("data:image") else s


def docs_to_csv(docs: list) -> str:
    headers, seen = [], set()
    for d in docs:
        for k in d.keys():
            if k not in seen:
                seen.add(k)
                headers.append(k)
    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(headers)
    for d in docs:
        w.writerow([_csv_cell(d.get(h)) for h in headers])
    return output.getvalue()


@router.get("/export/{dataset}")
async def export_dataset(dataset: str, user: dict = Depends(require_roles("Owner")), db: AsyncSession = Depends(get_db), start: Optional[str] = None, end: Optional[str] = None):
    model = EXPORT_MODELS.get(dataset)
    if not model:
        raise HTTPException(status_code=404, detail="Jenis data tidak dikenal")
    tid = user["tenant_id"]
    q = select(model).where(model.tenant_id == tid)
    if dataset in EXPORT_DATE_FILTERABLE:
        s_utc, e_utc = local_range_to_utc(start, end)
        if s_utc:
            q = q.where(model.created_at >= s_utc)
        if e_utc:
            q = q.where(model.created_at < e_utc)
    elif dataset in EXPORT_DATEFIELD_FILTERABLE:
        s, e = parse_date(start), parse_date(end)
        if s:
            q = q.where(model.date >= s)
        if e:
            q = q.where(model.date <= e)
    if hasattr(model, "created_at"):
        q = q.order_by(model.created_at.desc())
    rows = (await db.execute(q.limit(50000))).scalars().all()
    docs = [r.to_dict() for r in rows]
    body = "\ufeff" + docs_to_csv(docs)
    filename = f"{dataset}_{local_today().isoformat()}.csv"
    return Response(content=body, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
