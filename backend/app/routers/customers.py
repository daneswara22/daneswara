from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Customer, Sale
from ..schemas import CustomerInput
from ..security import get_current_user, require_roles

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
async def list_customers(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    customers = (await db.execute(select(Customer).where(Customer.tenant_id == tid).order_by(Customer.created_at.desc()))).scalars().all()
    agg_rows = (await db.execute(
        select(Sale.customer_id, func.coalesce(func.sum(Sale.total), 0), func.count())
        .where(Sale.tenant_id == tid, Sale.customer_id.is_not(None), Sale.refunded.is_(False))
        .group_by(Sale.customer_id)
    )).all()
    agg = {cid: (float(total), int(cnt)) for cid, total, cnt in agg_rows}
    out = []
    for c in customers:
        d = c.to_dict()
        total, cnt = agg.get(c.id, (0, 0))
        d["total_spent"], d["visits"] = total, cnt
        out.append(d)
    return out


@router.post("")
async def create_customer(data: CustomerInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    c = Customer(tenant_id=user["tenant_id"], **data.model_dump(), total_spent=0, visits=0)
    db.add(c)
    await db.commit()
    return c.to_dict()


@router.put("/{cid}")
async def update_customer(cid: str, data: CustomerInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Customer).where(Customer.id == cid, Customer.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    await db.commit()
    return {"ok": True}


@router.delete("/{cid}")
async def delete_customer(cid: str, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Customer).where(Customer.id == cid, Customer.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if c:
        await db.delete(c)
        await db.commit()
    return {"ok": True}


@router.get("/{cid}/history")
async def customer_history(cid: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Sale).where(Sale.tenant_id == user["tenant_id"], Sale.customer_id == cid, Sale.refunded.is_(False)).order_by(Sale.created_at.desc()).limit(500)
    )).scalars().all()
    return [s.to_dict() for s in rows]
