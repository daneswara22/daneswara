"""Expenses, other income and finance categories."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Expense, FinanceCategory, OtherIncome
from ..schemas import FinanceCategoryInput, FinanceEntryInput
from ..security import get_current_user, log_activity, require_roles
from ..utils import local_today, parse_date

router = APIRouter(tags=["finance"])

DEFAULT_EXPENSE_CATS = ["Pembelian Bahan DTF", "Pembelian ATK", "Biaya Operasional", "Jasa Pengambilan Online", "Pembelian Lain-lain"]
DEFAULT_INCOME_CATS = ["Biaya layanan", "Biaya express", "Biaya tambahan/order khusus", "Pendapatan komisi"]


def _defaults_for(kind: str):
    return DEFAULT_EXPENSE_CATS if kind == "expense" else DEFAULT_INCOME_CATS


async def _custom(db: AsyncSession, tid: str, kind: str):
    return (await db.execute(select(FinanceCategory).where(FinanceCategory.tenant_id == tid, FinanceCategory.type == kind).order_by(FinanceCategory.created_at))).scalars().all()


async def merged_category_names(db: AsyncSession, tid: str, kind: str):
    names = list(_defaults_for(kind))
    for c in await _custom(db, tid, kind):
        if c.name not in names:
            names.append(c.name)
    return names


@router.get("/finance-categories")
async def list_finance_categories(type: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    if type not in ("expense", "income"):
        raise HTTPException(status_code=400, detail="Tipe tidak valid")
    out = [{"id": None, "name": n, "is_default": True} for n in _defaults_for(type)]
    for c in await _custom(db, user["tenant_id"], type):
        out.append({"id": c.id, "name": c.name, "is_default": False})
    return out


@router.post("/finance-categories")
async def create_finance_category(data: FinanceCategoryInput, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama kategori wajib diisi")
    existing = await merged_category_names(db, user["tenant_id"], data.type)
    if name.lower() in [n.lower() for n in existing]:
        raise HTTPException(status_code=400, detail="Kategori sudah ada")
    c = FinanceCategory(tenant_id=user["tenant_id"], type=data.type, name=name)
    db.add(c)
    await log_activity(db, user["tenant_id"], user, "Tambah Kategori Keuangan", f"{data.type}: {name}")
    await db.commit()
    return c.to_dict()


@router.delete("/finance-categories/{cid}")
async def delete_finance_category(cid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(FinanceCategory).where(FinanceCategory.id == cid, FinanceCategory.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if c:
        await db.delete(c)
        await db.commit()
    return {"ok": True}


# ---------- generic helpers for expenses / other income ----------
async def _list_entries(model, db: AsyncSession, tid: str, start: Optional[str], end: Optional[str]):
    q = select(model).where(model.tenant_id == tid)
    s, e = parse_date(start), parse_date(end)
    if s:
        q = q.where(model.date >= s)
    if e:
        q = q.where(model.date <= e)
    rows = (await db.execute(q.order_by(model.date.desc(), model.created_at.desc()).limit(5000))).scalars().all()
    return [r.to_dict() for r in rows]


async def _create_entry(model, data: FinanceEntryInput, db: AsyncSession, user: dict, action: str):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Nominal harus lebih dari 0")
    d = parse_date(data.date) or local_today()
    row = model(tenant_id=user["tenant_id"], category=data.category, amount=data.amount, note=data.note or "", date=d, user_name=user.get("name", ""))
    db.add(row)
    await log_activity(db, user["tenant_id"], user, action, f"{data.category} - {data.amount}")
    await db.commit()
    return row.to_dict()


async def _delete_entry(model, eid: str, db: AsyncSession, user: dict):
    row = (await db.execute(select(model).where(model.id == eid, model.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.commit()
    return {"ok": True}


# ---------- Expenses ----------
@router.get("/expense-categories")
async def expense_categories(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await merged_category_names(db, user["tenant_id"], "expense")


@router.get("/expenses")
async def list_expenses(user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db), start: Optional[str] = None, end: Optional[str] = None):
    return await _list_entries(Expense, db, user["tenant_id"], start, end)


@router.post("/expenses")
async def create_expense(data: FinanceEntryInput, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    return await _create_entry(Expense, data, db, user, "Tambah Pengeluaran")


@router.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    return await _delete_entry(Expense, eid, db, user)


# ---------- Other income ----------
@router.get("/other-income-categories")
async def other_income_categories(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await merged_category_names(db, user["tenant_id"], "income")


@router.get("/other-income")
async def list_other_income(user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db), start: Optional[str] = None, end: Optional[str] = None):
    return await _list_entries(OtherIncome, db, user["tenant_id"], start, end)


@router.post("/other-income")
async def create_other_income(data: FinanceEntryInput, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    return await _create_entry(OtherIncome, data, db, user, "Tambah Pendapatan Lain-lain")


@router.delete("/other-income/{eid}")
async def delete_other_income(eid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    return await _delete_entry(OtherIncome, eid, db, user)
