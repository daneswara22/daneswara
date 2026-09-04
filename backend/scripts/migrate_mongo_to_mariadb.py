#!/usr/bin/env python3
"""
Migrate the legacy DanesPOS MongoDB (Atlas) database into MariaDB.

Usage (from /app/backend):
    python scripts/migrate_mongo_to_mariadb.py --mongo "mongodb+srv://user:pass@host/?..." [--db test_database] [--wipe] [--dry-run] [--no-images]

    --mongo      Mongo URI (or env MONGO_URI). Default database from URI path or --db.
    --db         Mongo database name (default: first non-system DB found, or DB_NAME env).
    --wipe       Delete existing MariaDB rows of migrated tables first (gallery_items untouched).
    --dry-run    Only print collection counts & field coverage, write nothing.
    --no-images  Keep base64 data-URI images as-is instead of converting to WebP + uploading to R2/local.

Target MariaDB comes from DATABASE_URL (backend/.env). Idempotent: rows are upserted by id.
Base64 images (products/categories/logo) are converted to WebP and pushed to storage (R2 or local fallback).
"""
import argparse
import logging
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pymongo import MongoClient  # noqa: E402
from sqlalchemy import create_engine, delete  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app import models  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import Base  # noqa: E402
from app.storage import decode_data_uri, storage, to_webp  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("migrate")

# collection -> (model, image fields)
COLLECTIONS = [
    ("tenants", models.Tenant, ()),
    ("users", models.User, ()),
    ("categories", models.Category, ("image",)),
    ("products", models.Product, ("image",)),
    ("stock_movements", models.StockMovement, ()),
    ("sales", models.Sale, ()),
    ("orders", models.Order, ()),
    ("purchases", models.Purchase, ()),
    ("held_orders", models.HeldOrder, ()),
    ("customers", models.Customer, ()),
    ("suppliers", models.Supplier, ()),
    ("expenses", models.Expense, ()),
    ("other_income", models.OtherIncome, ()),
    ("finance_categories", models.FinanceCategory, ()),
    ("settings", models.TenantSettings, ("logo",)),
    ("user_settings", models.UserSettings, ()),
    ("activities", models.Activity, ()),
]
WIPE_ORDER = [c for c, _, _ in COLLECTIONS]


def parse_dt(v):
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        dt = v
    else:
        s = str(v).strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            try:
                dt = datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def parse_d(v):
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def convert_image(value, kind, no_images: bool):
    if not value or not isinstance(value, str) or not value.startswith("data:image") or no_images:
        return value
    raw = decode_data_uri(value)
    if raw is None:
        return ""
    try:
        webp, _, _ = to_webp(raw, kind)
        key = storage._key(kind, "webp")
        return storage._put_sync(key, webp, "image/webp")
    except Exception as e:  # pragma: no cover
        log.warning("image convert failed (%s): %s", kind, e)
        return ""


def coerce(model, doc: dict, image_fields, no_images: bool):
    cols = {c.name: c for c in model.__table__.columns}
    row, unknown = {}, []
    for k, v in doc.items():
        if k == "_id":
            continue
        if k not in cols:
            unknown.append(k)
            continue
        col = cols[k]
        pytype = col.type.python_type if hasattr(col.type, "python_type") else None
        try:
            if pytype is datetime:
                v = parse_dt(v)
            elif pytype is date:
                v = parse_d(v)
            elif pytype is bool:
                v = bool(v) if v is not None else None
            elif pytype is int and v is not None and not isinstance(v, (dict, list)):
                v = int(float(v))
            elif pytype is float and v is not None and not isinstance(v, (dict, list)):
                v = float(v)
            elif pytype is str and v is not None and not isinstance(v, str):
                v = str(v)
        except Exception:
            pass
        if k in image_fields:
            v = convert_image(v, "logo" if k == "logo" else model.__tablename__[:-1] if model.__tablename__.endswith("s") else "misc", no_images)
        if pytype is str and v is not None and hasattr(col.type, "length") and col.type.length and len(v) > col.type.length:
            v = v[: col.type.length]
        row[k] = v
    # defaults for required datetime columns
    if "created_at" in cols and row.get("created_at") is None:
        row["created_at"] = datetime.now(timezone.utc).replace(tzinfo=None)
    if model is models.Expense or model is models.OtherIncome:
        if row.get("date") is None:
            row["date"] = (row.get("created_at") or datetime.utcnow()).date()
    return row, unknown


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mongo", default=os.environ.get("MONGO_URI") or os.environ.get("MONGO_URL"))
    ap.add_argument("--db", default=os.environ.get("DB_NAME"))
    ap.add_argument("--wipe", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-images", action="store_true")
    ap.add_argument("--batch", type=int, default=500)
    args = ap.parse_args()
    if not args.mongo:
        ap.error("--mongo (or MONGO_URI env) is required")

    client = MongoClient(args.mongo, serverSelectionTimeoutMS=20000)
    db_name = args.db
    if not db_name:
        names = [n for n in client.list_database_names() if n not in ("admin", "local", "config")]
        if not names:
            log.error("No databases found in Mongo")
            sys.exit(1)
        db_name = names[0]
        log.info("Using Mongo database: %s (available: %s)", db_name, names)
    mdb = client[db_name]

    sync_url = settings.DATABASE_URL.replace("mysql+aiomysql://", "mysql+pymysql://")
    engine = create_engine(sync_url, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    log.info("Target MariaDB: %s | storage backend: %s", sync_url.split("@")[-1], storage.backend)

    with Session(engine) as s:
        if args.wipe and not args.dry_run:
            for coll in reversed(WIPE_ORDER):
                model = dict((c, m) for c, m, _ in COLLECTIONS)[coll]
                r = s.execute(delete(model))
                log.info("wiped %-18s %6d rows", model.__tablename__, r.rowcount)
            s.commit()

        total = 0
        for coll, model, image_fields in COLLECTIONS:
            if coll not in mdb.list_collection_names():
                log.info("%-18s (absent in Mongo) skip", coll)
                continue
            n = mdb[coll].estimated_document_count()
            log.info("%-18s %6d docs -> %s", coll, n, model.__tablename__)
            if args.dry_run:
                sample = mdb[coll].find_one() or {}
                _, unknown = coerce(model, sample, image_fields, True)
                if unknown:
                    log.info("   fields not in schema (ignored): %s", unknown)
                continue
            unknown_all, done = set(), 0
            for doc in mdb[coll].find({}, no_cursor_timeout=True):
                row, unknown = coerce(model, doc, image_fields, args.no_images)
                unknown_all.update(unknown)
                pk = "tenant_id" if model is models.TenantSettings else "id"
                if not row.get(pk):
                    continue
                s.merge(model(**row))
                done += 1
                if done % args.batch == 0:
                    s.commit()
                    log.info("   ... %d/%d", done, n)
            s.commit()
            total += done
            log.info("   migrated %d rows%s", done, f" | ignored fields: {sorted(unknown_all)}" if unknown_all else "")
        log.info("DONE. %d rows migrated into MariaDB.", total)


if __name__ == "__main__":
    main()
