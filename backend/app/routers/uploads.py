"""Image upload -> WebP -> R2 (or local fallback)."""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from ..security import get_current_user
from ..storage import IMAGE_PROFILES, storage

router = APIRouter(tags=["uploads"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024


@router.post("/upload")
async def upload_image(file: UploadFile = File(...), kind: str = Query("misc"), user: dict = Depends(get_current_user)):
    if kind not in IMAGE_PROFILES:
        kind = "misc"
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Ukuran gambar maksimal 15MB")
    try:
        info = await storage.upload_image(raw, kind)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gambar tidak bisa diproses: {e}")
    return info


@router.get("/storage/status")
async def storage_status(user: dict = Depends(get_current_user)):
    return {"backend": storage.backend}
