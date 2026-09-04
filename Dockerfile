# ===================================================================================
# Daneswara - SINGLE-CONTAINER image for Coolify "Dockerfile" build pack.
#   nginx (:80)  ->  static React (landing + DanesPOS)
#                ->  /api/*  proxied to uvicorn (FastAPI) on 127.0.0.1:8001 (same container)
# Set the Coolify resource port to 80. Env vars: see backend/.env.example (DATABASE_URL, JWT_SECRET, R2_*...).
# (docker-compose.yml is the alternative two-service layout.)
# ===================================================================================

# ---- Stage 1: build frontend ----
FROM node:20-alpine AS web
WORKDIR /web
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    GENERATE_SOURCEMAP=false \
    DISABLE_ESLINT_PLUGIN=true \
    NODE_OPTIONS=--max-old-space-size=2048
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY frontend/ ./
RUN yarn build

# ---- Stage 2: runtime (python + nginx) ----
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UPLOAD_DIR=/data/uploads \
    API_PORT=8001

RUN apt-get update && apt-get install -y --no-install-recommends nginx curl \
    && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default

WORKDIR /srv
COPY backend/requirements.prod.txt ./
RUN pip install --upgrade pip && pip install -r requirements.prod.txt

COPY backend/app ./app
COPY backend/scripts ./scripts
COPY backend/data ./data
COPY backend/server.py ./

COPY --from=web /web/build /usr/share/nginx/html
COPY deploy/nginx-single.conf /etc/nginx/conf.d/default.conf
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh && mkdir -p /data/uploads

VOLUME ["/data/uploads"]
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1/api/health || exit 1

CMD ["/start.sh"]
