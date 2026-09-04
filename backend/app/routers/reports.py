"""Dashboard + reports (sales, monthly, profit-loss, cash-flow). SQL aggregation where cheap, Python for tz-aware grouping."""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..models import Activity, Expense, OtherIncome, Product, Purchase, Sale
from ..security import get_current_user, require_roles
from ..utils import local_date_of, local_range_to_utc, local_today, parse_date

router = APIRouter(tags=["reports"])


def _sales_query(tid: str, start: Optional[str] = None, end: Optional[str] = None):
    q = select(Sale).where(Sale.tenant_id == tid, Sale.refunded.is_(False))
    s_utc, e_utc = local_range_to_utc(start, end)
    if s_utc:
        q = q.where(Sale.created_at >= s_utc)
    if e_utc:
        q = q.where(Sale.created_at < e_utc)
    return q


async def _sales(db: AsyncSession, tid: str, start=None, end=None, limit: int = 20000):
    return (await db.execute(_sales_query(tid, start, end).order_by(Sale.created_at.desc()).limit(limit))).scalars().all()


@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    today = local_today()
    week_start = today - timedelta(days=6)
    totals = (await db.execute(select(func.coalesce(func.sum(Sale.total), 0), func.count()).where(Sale.tenant_id == tid, Sale.refunded.is_(False)))).one()
    total_revenue, total_transactions = float(totals[0]), int(totals[1])

    recent = await _sales(db, tid, week_start.isoformat(), today.isoformat())
    today_sales = [s for s in recent if local_date_of(s.created_at) == today]
    series = []
    for d in range(6, -1, -1):
        day = today - timedelta(days=d)
        series.append({"date": day.isoformat()[5:], "total": sum(s.total for s in recent if local_date_of(s.created_at) == day)})

    products = (await db.execute(select(Product).where(Product.tenant_id == tid))).scalars().all()
    low_stock = [p.to_dict() for p in products if (p.stock or 0) <= (p.min_stock or 5)]
    minus_stock = [p.to_dict() for p in products if (p.stock or 0) < 0]

    # top products (all time) from JSON items
    all_items = (await db.execute(select(Sale.items).where(Sale.tenant_id == tid, Sale.refunded.is_(False)))).scalars().all()
    prod_qty: dict = {}
    for items in all_items:
        for i in items or []:
            prod_qty[i.get("name")] = prod_qty.get(i.get("name"), 0) + int(i.get("qty", 0))
    top_products = [{"name": n, "qty": q} for n, q in sorted(prod_qty.items(), key=lambda x: -x[1])[:5]]

    activities = (await db.execute(select(Activity).where(Activity.tenant_id == tid).order_by(Activity.created_at.desc()).limit(8))).scalars().all()
    return {
        "today_revenue": sum(s.total for s in today_sales), "today_transactions": len(today_sales),
        "today_profit": sum(s.profit or 0 for s in today_sales), "total_revenue": total_revenue,
        "total_transactions": total_transactions, "product_count": len(products),
        "low_stock_count": len(low_stock), "low_stock": low_stock[:10],
        "minus_stock_count": len(minus_stock), "minus_stock": minus_stock[:20],
        "sales_series": series, "top_products": top_products, "activities": [a.to_dict() for a in activities],
    }


@router.get("/reports/sales")
async def report_sales(user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db), start: Optional[str] = None, end: Optional[str] = None):
    sales = await _sales(db, user["tenant_id"], start, end)
    by_method: dict = {}
    by_channel: dict = {}
    for s in sales:
        e = by_method.setdefault(s.payment_method, {"total": 0, "count": 0})
        e["total"] += s.total
        e["count"] += 1
        ce = by_channel.setdefault(s.channel or "Toko", {"total": 0, "profit": 0, "count": 0})
        ce["total"] += s.total
        ce["profit"] += s.profit or 0
        ce["count"] += 1
    return {
        "count": len(sales), "total": sum(s.total for s in sales), "profit": sum(s.profit or 0 for s in sales),
        "by_method": [{"method": k, "total": v["total"], "count": v["count"]} for k, v in by_method.items()],
        "by_channel": sorted([{"channel": k, **v} for k, v in by_channel.items()], key=lambda x: -x["total"]),
        "sales": [s.to_dict() for s in sales],
    }


@router.get("/reports/monthly")
async def report_monthly(user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db), year: int = Query(...)):
    tid = user["tenant_id"]
    months = [{"month": m, "total": 0, "profit": 0, "expense": 0, "other_income": 0, "net": 0, "count": 0} for m in range(1, 13)]
    sales = await _sales(db, tid, f"{year}-01-01", f"{year}-12-31")
    for s in sales:
        d = local_date_of(s.created_at)
        if d and d.year == year:
            months[d.month - 1]["total"] += s.total
            months[d.month - 1]["profit"] += s.profit or 0
            months[d.month - 1]["count"] += 1
    for model, key in ((Expense, "expense"), (OtherIncome, "other_income")):
        rows = (await db.execute(select(model.date, func.coalesce(func.sum(model.amount), 0)).where(model.tenant_id == tid, model.date >= date(year, 1, 1), model.date <= date(year, 12, 31)).group_by(model.date))).all()
        for d, amount in rows:
            months[d.month - 1][key] += float(amount)
    for mo in months:
        mo["net"] = mo["profit"] + mo["other_income"] - mo["expense"]
    return {"year": year, "months": months}


async def _finance_rows(model, db: AsyncSession, tid: str, start, end):
    q = select(model).where(model.tenant_id == tid)
    s, e = parse_date(start), parse_date(end)
    if s:
        q = q.where(model.date >= s)
    if e:
        q = q.where(model.date <= e)
    return (await db.execute(q)).scalars().all()


@router.get("/reports/profit-loss")
async def report_profit_loss(user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db), start: Optional[str] = None, end: Optional[str] = None):
    tid = user["tenant_id"]
    sales = await _sales(db, tid, start, end)
    revenue = sum(s.total for s in sales)
    hpp = sum(s.cost or 0 for s in sales)
    expenses = await _finance_rows(Expense, db, tid, start, end)
    other_income = await _finance_rows(OtherIncome, db, tid, start, end)
    by_cat: dict = {}
    for e in expenses:
        by_cat[e.category] = by_cat.get(e.category, 0) + e.amount
    oi_by_cat: dict = {}
    for e in other_income:
        oi_by_cat[e.category] = oi_by_cat.get(e.category, 0) + e.amount
    expense_total = sum(e.amount for e in expenses)
    other_income_total = sum(e.amount for e in other_income)
    return {
        "revenue": revenue, "hpp": hpp, "gross_profit": revenue - hpp, "expense_total": expense_total,
        "expenses_by_category": [{"category": k, "amount": v} for k, v in by_cat.items()],
        "other_income_total": other_income_total,
        "other_income_by_category": [{"category": k, "amount": v} for k, v in oi_by_cat.items()],
        "net_profit": (revenue - hpp) + other_income_total - expense_total,
        "sales_count": len(sales), "expense_count": len(expenses), "other_income_count": len(other_income),
    }


@router.get("/reports/cash-flow")
async def report_cash_flow(user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db), start: Optional[str] = None, end: Optional[str] = None):
    tid = user["tenant_id"]
    sales = await _sales(db, tid, start, end)
    sales_in = sum(s.total for s in sales)
    other_income = await _finance_rows(OtherIncome, db, tid, start, end)
    oi_in = sum(e.amount for e in other_income)
    expenses = await _finance_rows(Expense, db, tid, start, end)
    exp_by_cat: dict = {}
    for e in expenses:
        exp_by_cat[e.category] = exp_by_cat.get(e.category, 0) + e.amount
    exp_out = sum(e.amount for e in expenses)
    q = select(Purchase).where(Purchase.tenant_id == tid, Purchase.status == "Diterima")
    s_utc, e_utc = local_range_to_utc(start, end)
    ref = func.coalesce(Purchase.received_at, Purchase.created_at)
    if s_utc:
        q = q.where(ref >= s_utc)
    if e_utc:
        q = q.where(ref < e_utc)
    purchases = (await db.execute(q)).scalars().all()
    purchase_out = sum(p.total or 0 for p in purchases)
    inflow_total, outflow_total = sales_in + oi_in, purchase_out + exp_out
    return {
        "inflow": {"sales": sales_in, "other_income": oi_in, "total": inflow_total},
        "outflow": {"purchases": purchase_out, "expenses": exp_out, "total": outflow_total,
                    "expenses_by_category": [{"category": k, "amount": v} for k, v in exp_by_cat.items()]},
        "net_cash": inflow_total - outflow_total, "sales_count": len(sales), "purchase_count": len(purchases), "expense_count": len(expenses),
    }
