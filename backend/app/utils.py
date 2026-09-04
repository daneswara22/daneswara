import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, Tuple

from .config import settings


def new_id() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    """Naive UTC datetime for storage in MariaDB DATETIME columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def local_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(settings.tz)


def local_today() -> date:
    return local_now().date()


def local_date_of(dt: Optional[datetime]) -> Optional[date]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(settings.tz).date()


def parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    try:
        return date.fromisoformat(str(s)[:10])
    except ValueError:
        return None


def local_range_to_utc(start: Optional[str], end: Optional[str]) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Convert local YYYY-MM-DD boundaries into naive UTC datetimes for DATETIME comparisons."""
    tz = settings.tz
    s = parse_date(start)
    e = parse_date(end)
    start_utc = end_utc = None
    if s:
        start_utc = datetime.combine(s, time.min, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    if e:
        end_utc = (datetime.combine(e, time.min, tzinfo=tz) + timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None)
    return start_utc, end_utc


def doc_number(prefix: str, count: int) -> str:
    return f"{prefix}-{local_now().strftime('%y%m%d')}-{count + 1:04d}"


def rp(n: float) -> str:
    return f"Rp{n:,.0f}"
