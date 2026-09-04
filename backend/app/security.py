from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import get_db
from .models import Activity, User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, tenant_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "tid": tenant_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _extract_token(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def public_user(user: User) -> dict:
    return user.to_dict(exclude=("password_hash",))


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = (await db.execute(select(User).where(User.id == payload.get("sub")))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    if not user.active:
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    return public_user(user)


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if roles and user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak untuk peran Anda")
        return user

    return checker


async def log_activity(db: AsyncSession, tenant_id: str, user: dict, action: str, detail: str) -> None:
    db.add(Activity(tenant_id=tenant_id, user_id=user.get("id"), user_name=user.get("name", ""), action=action, detail=detail))
