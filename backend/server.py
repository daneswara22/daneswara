"""Daneswara API - FastAPI + SQLAlchemy(async) + MariaDB + Cloudflare R2.

Run (dev):  uvicorn server:app --host 0.0.0.0 --port 8001 --reload
"""
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import SessionLocal, engine, init_db
from app.routers import admin, auth, catalog, customers, finance, gallery, orders, purchases, reports, sales, settings as settings_router, uploads, users
from app.seed import run_seed
from app.storage import storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("daneswara")


async def wait_for_db(max_seconds: int = 120) -> None:
    """Retry schema init until MariaDB is reachable (container/DB may start after the API)."""
    import asyncio

    deadline = asyncio.get_running_loop().time() + max_seconds
    attempt = 0
    while True:
        try:
            await init_db()
            return
        except Exception as e:
            attempt += 1
            if asyncio.get_running_loop().time() > deadline:
                logger.error("Database still unreachable after %ss: %s", max_seconds, e)
                raise
            logger.warning("Database not ready (attempt %d): %s - retrying in 3s", attempt, str(e).splitlines()[0][:160])
            await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await wait_for_db()
    async with SessionLocal() as db:
        try:
            await run_seed(db)
        except Exception as e:  # never block startup on seed problems
            logger.exception("Seed failed: %s", e)
    logger.info("Daneswara API ready | storage=%s | tz=%s", storage.backend, settings.TIMEZONE)
    yield
    await engine.dispose()


app = FastAPI(title="Daneswara API", version="2.0.0", lifespan=lifespan)

api = APIRouter(prefix="/api")
for r in (auth.router, users.router, catalog.router, sales.router, orders.router, purchases.router, customers.router,
          finance.router, reports.router, settings_router.router, admin.router, gallery.router, uploads.router):
    api.include_router(r)


@api.get("/")
async def api_root():
    return {"message": "Daneswara API", "version": "2.0.0", "storage": storage.backend}


@api.get("/health")
async def api_health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "healthy" if db_ok else "degraded", "database": "ok" if db_ok else "error", "storage": storage.backend}


app.include_router(api)

# Local storage fallback (only used when R2 is not configured)
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/files", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="files")


@app.get("/health")
async def health():
    return {"status": "healthy"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
