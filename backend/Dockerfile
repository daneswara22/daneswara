# ---- Daneswara API (FastAPI + MariaDB + R2) ----
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UPLOAD_DIR=/data/uploads

WORKDIR /srv

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.prod.txt ./
RUN pip install --upgrade pip && pip install -r requirements.prod.txt

COPY app ./app
COPY scripts ./scripts
COPY data ./data
COPY server.py ./

RUN mkdir -p /data/uploads
VOLUME ["/data/uploads"]

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8001/api/health || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips=*", "--workers", "2"]
