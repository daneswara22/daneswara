"""Media storage: Cloudflare R2 (S3 API) with WebP normalisation and a local-disk fallback."""
import asyncio
import base64
import io
import logging
import re
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image, ImageOps

from .config import settings
from .utils import new_id

logger = logging.getLogger(__name__)

# kind -> (max side px, webp quality)
IMAGE_PROFILES = {
    "gallery": (1600, 82),
    "product": (800, 80),
    "category": (800, 80),
    "logo": (800, 90),
    "misc": (1600, 82),
}

_DATA_URI_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)


def to_webp(raw: bytes, kind: str = "misc") -> Tuple[bytes, int, int]:
    """Convert any Pillow-readable image to WebP (keeps alpha), capped to the profile max side."""
    max_side, quality = IMAGE_PROFILES.get(kind, IMAGE_PROFILES["misc"])
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im)
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "A" in im.getbands() or im.mode == "P" else "RGB")
    w, h = im.size
    scale = min(1.0, max_side / float(max(w, h)))
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue(), im.size[0], im.size[1]


def decode_data_uri(uri: str) -> Optional[bytes]:
    m = _DATA_URI_RE.match(uri.strip())
    if not m:
        return None
    try:
        return base64.b64decode(m.group(2))
    except Exception:
        return None


class Storage:
    def __init__(self) -> None:
        self._client = None
        self.backend = "local"
        if settings.r2_enabled:
            try:
                import boto3
                from botocore.config import Config

                self._client = boto3.client(
                    "s3",
                    endpoint_url=settings.r2_endpoint,
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    region_name="auto",
                    config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
                )
                self.backend = "r2"
            except Exception as e:  # pragma: no cover
                logger.error("R2 client init failed, falling back to local storage: %s", e)
        settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        logger.info("Storage backend: %s", self.backend)

    # ---- key / url helpers ----
    def _key(self, kind: str, ext: str = "webp") -> str:
        prefix = f"{settings.R2_PREFIX}/" if settings.R2_PREFIX else ""
        return f"{prefix}{kind}/{new_id()}.{ext}"

    def public_url(self, key: str) -> str:
        if self.backend == "r2":
            base = settings.R2_PUBLIC_BASE_URL or f"{settings.r2_endpoint}/{settings.R2_BUCKET}"
            return f"{base}/{key}"
        return f"{settings.PUBLIC_BASE_URL}/api/files/{key}"

    # ---- sync workers ----
    def _put_sync(self, key: str, body: bytes, content_type: str) -> str:
        if self.backend == "r2":
            try:
                self._client.put_object(
                    Bucket=settings.R2_BUCKET, Key=key, Body=body, ContentType=content_type,
                    CacheControl="public, max-age=31536000, immutable",
                )
                return self.public_url(key)
            except Exception as e:
                logger.error("R2 upload failed (%s); writing to local fallback", e)
        path = settings.UPLOAD_DIR / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return f"{settings.PUBLIC_BASE_URL}/api/files/{key}"

    def _delete_sync(self, url: str) -> None:
        key = self.key_from_url(url)
        if not key:
            return
        if self.backend == "r2":
            try:
                self._client.delete_object(Bucket=settings.R2_BUCKET, Key=key)
                return
            except Exception as e:
                logger.warning("R2 delete failed: %s", e)
        p = settings.UPLOAD_DIR / key
        if p.exists():
            try:
                p.unlink()
            except OSError:
                pass

    def key_from_url(self, url: Optional[str]) -> Optional[str]:
        if not url:
            return None
        marker = "/api/files/"
        if marker in url:
            return url.split(marker, 1)[1]
        if self.backend == "r2":
            base = settings.R2_PUBLIC_BASE_URL or f"{settings.r2_endpoint}/{settings.R2_BUCKET}"
            if base and url.startswith(base + "/"):
                return url[len(base) + 1:]
        return None

    # ---- async API ----
    async def upload_image(self, raw: bytes, kind: str = "misc") -> dict:
        loop = asyncio.get_running_loop()
        webp, w, h = await loop.run_in_executor(None, to_webp, raw, kind)
        key = self._key(kind, "webp")
        url = await loop.run_in_executor(None, self._put_sync, key, webp, "image/webp")
        return {"url": url, "key": key, "width": w, "height": h, "bytes": len(webp), "backend": self.backend}

    async def upload_data_uri(self, uri: str, kind: str = "misc") -> Optional[str]:
        raw = decode_data_uri(uri)
        if raw is None:
            return None
        info = await self.upload_image(raw, kind)
        return info["url"]

    async def normalize_image_field(self, value: Optional[str], kind: str) -> Optional[str]:
        """If a client still sends base64 data URIs, convert & upload transparently."""
        if value and value.startswith("data:image"):
            url = await self.upload_data_uri(value, kind)
            return url or ""
        return value

    async def delete(self, url: Optional[str]) -> None:
        if not url:
            return
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._delete_sync, url)


storage = Storage()
