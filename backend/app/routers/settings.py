from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import TenantSettings, UserSettings
from ..schemas import SettingsInput
from ..security import get_current_user
from ..storage import storage

router = APIRouter(prefix="/settings", tags=["settings"])

PRINTER_FIELDS = {"print_mode", "paper_width", "printers", "active_printer"}


@router.get("")
async def get_settings(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    s = (await db.execute(select(TenantSettings).where(TenantSettings.tenant_id == tid))).scalar_one_or_none()
    out = s.to_dict() if s else {"tenant_id": tid}
    us = (await db.execute(select(UserSettings).where(UserSettings.tenant_id == tid, UserSettings.user_id == user["id"]))).scalar_one_or_none()
    if us:
        d = us.to_dict()
        for f in PRINTER_FIELDS:
            if d.get(f) is not None:
                out[f] = d[f]
    return out


@router.put("")
async def update_settings(data: SettingsInput, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tid = user["tenant_id"]
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    printer_patch = {k: v for k, v in upd.items() if k in PRINTER_FIELDS}
    biz_patch = {k: v for k, v in upd.items() if k not in PRINTER_FIELDS}
    if printer_patch:
        us = (await db.execute(select(UserSettings).where(UserSettings.tenant_id == tid, UserSettings.user_id == user["id"]))).scalar_one_or_none()
        if not us:
            us = UserSettings(tenant_id=tid, user_id=user["id"])
            db.add(us)
        for k, v in printer_patch.items():
            setattr(us, k, v)
    if biz_patch and user["role"] in ("Owner", "Manager"):
        s = (await db.execute(select(TenantSettings).where(TenantSettings.tenant_id == tid))).scalar_one_or_none()
        if not s:
            s = TenantSettings(tenant_id=tid)
            db.add(s)
        if "logo" in biz_patch:
            new_logo = await storage.normalize_image_field(biz_patch["logo"], "logo")
            if s.logo and new_logo != s.logo:
                await storage.delete(s.logo)
            biz_patch["logo"] = new_logo or ""
        for k, v in biz_patch.items():
            setattr(s, k, v)
    await db.commit()
    return {"ok": True}
