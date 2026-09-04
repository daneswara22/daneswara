from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..models import User
from ..schemas import ChangePasswordInput, LoginInput
from ..security import create_access_token, get_current_user, hash_password, public_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(data: LoginInput, response: Response, db: AsyncSession = Depends(get_db)):
    uname = data.username.lower().strip()
    user = (await db.execute(select(User).where(User.username == uname))).scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    if not user.active:
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    token = create_access_token(user.id, user.tenant_id, user.role)
    response.set_cookie(
        "access_token", token, httponly=True, secure=settings.COOKIE_SECURE,
        samesite="none" if settings.COOKIE_SECURE else "lax", max_age=settings.JWT_EXPIRE_DAYS * 86400, path="/",
    )
    return {"user": public_user(user), "token": token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/change-password")
async def change_password(data: ChangePasswordInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
    record = (await db.execute(select(User).where(User.id == user["id"]))).scalar_one_or_none()
    if not record or not verify_password(data.current_password, record.password_hash):
        raise HTTPException(status_code=400, detail="Password lama salah")
    record.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"ok": True}
