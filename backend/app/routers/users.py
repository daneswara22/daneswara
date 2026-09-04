from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import User
from ..schemas import UserCreate, UserUpdate
from ..security import hash_password, log_activity, public_user, require_roles

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).where(User.tenant_id == user["tenant_id"]).order_by(User.created_at))).scalars().all()
    return [public_user(u) for u in rows]


@router.post("")
async def create_user(data: UserCreate, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    uname = data.username.lower().strip()
    if (await db.execute(select(User.id).where(User.username == uname))).first():
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    u = User(tenant_id=user["tenant_id"], username=uname, password_hash=hash_password(data.password), name=data.name, role=data.role, active=True)
    db.add(u)
    await log_activity(db, user["tenant_id"], user, "Tambah Pengguna", f"{data.name} ({data.role})")
    await db.commit()
    out = public_user(u)
    out["password_hash"] = None
    return out


@router.put("/{uid}")
async def update_user(uid: str, data: UserUpdate, user: dict = Depends(require_roles("Owner", "Manager")), db: AsyncSession = Depends(get_db)):
    target = (await db.execute(select(User).where(User.id == uid, User.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if data.name is not None:
        target.name = data.name
    if data.role is not None:
        target.role = data.role
    if data.active is not None:
        target.active = data.active
    if data.password:
        target.password_hash = hash_password(data.password)
    await db.commit()
    return {"ok": True}


@router.delete("/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("Owner")), db: AsyncSession = Depends(get_db)):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri")
    target = (await db.execute(select(User).where(User.id == uid, User.tenant_id == user["tenant_id"]))).scalar_one_or_none()
    if target:
        await db.delete(target)
        await db.commit()
    return {"ok": True}
