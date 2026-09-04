import os
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    v = os.environ.get(name)
    return v if v is not None and v != "" else default


def normalize_db_url(url: str) -> str:
    """Accept Coolify style `mysql://u:p@host:3306/db` and SQLAlchemy style URLs."""
    url = (url or "").strip()
    if url.startswith("mysql+aiomysql://"):
        return url
    if url.startswith("mysql://"):
        return "mysql+aiomysql://" + url[len("mysql://"):]
    if url.startswith("mariadb://"):
        return "mysql+aiomysql://" + url[len("mariadb://"):]
    if url.startswith("mysql+pymysql://"):
        return "mysql+aiomysql://" + url[len("mysql+pymysql://"):]
    return url


class Settings:
    # --- database (MariaDB) ---
    DATABASE_URL: str = normalize_db_url(_env("DATABASE_URL", "mysql://daneswara:daneswara_dev@127.0.0.1:3306/default"))
    DB_ECHO: bool = _env("DB_ECHO", "false").lower() == "true"

    # --- auth ---
    JWT_SECRET: str = _env("JWT_SECRET", "change-me-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = int(_env("JWT_EXPIRE_DAYS", "7"))
    COOKIE_SECURE: bool = _env("COOKIE_SECURE", "true").lower() == "true"

    # --- owner seed ---
    OWNER_USERNAME: str = _env("OWNER_USERNAME", "admin")
    OWNER_PASSWORD: str = _env("OWNER_PASSWORD", "ChangeMe123!")
    OWNER_NAME: str = _env("OWNER_NAME", "Owner")
    OWNER_BUSINESS: str = _env("OWNER_BUSINESS", "Daneswara Print")
    SEED_CATALOG: bool = _env("SEED_CATALOG", "true").lower() == "true"
    SEED_CUSTOMERS: bool = _env("SEED_CUSTOMERS", "true").lower() == "true"
    SEED_GALLERY: bool = _env("SEED_GALLERY", "true").lower() == "true"

    # --- misc ---
    CORS_ORIGINS: list = [o.strip() for o in _env("CORS_ORIGINS", "*").split(",") if o.strip()]
    TIMEZONE: str = _env("TIMEZONE", "Asia/Makassar")
    PUBLIC_BASE_URL: str = _env("PUBLIC_BASE_URL", "").rstrip("/")  # used for local upload fallback URLs

    # --- Cloudflare R2 (S3 compatible) ---
    R2_ACCOUNT_ID: str = _env("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = _env("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = _env("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET: str = _env("R2_BUCKET", "")
    R2_ENDPOINT: str = _env("R2_ENDPOINT", "").rstrip("/")
    R2_PUBLIC_BASE_URL: str = _env("R2_PUBLIC_BASE_URL", "").rstrip("/")
    R2_PREFIX: str = _env("R2_PREFIX", "daneswara").strip("/")

    UPLOAD_DIR: Path = Path(_env("UPLOAD_DIR", str(ROOT_DIR / "uploads")))
    DATA_DIR: Path = ROOT_DIR / "data"

    @property
    def tz(self) -> ZoneInfo:
        try:
            return ZoneInfo(self.TIMEZONE)
        except Exception:
            return ZoneInfo("UTC")

    @property
    def r2_enabled(self) -> bool:
        return bool(self.R2_ACCESS_KEY_ID and self.R2_SECRET_ACCESS_KEY and self.R2_BUCKET and (self.R2_ENDPOINT or self.R2_ACCOUNT_ID))

    @property
    def r2_endpoint(self) -> str:
        if self.R2_ENDPOINT:
            return self.R2_ENDPOINT
        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"


settings = Settings()
