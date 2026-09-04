# ---- Daneswara web (landing + DanesPOS) ----
# Stage 1: build the React app
FROM node:20-alpine AS build
WORKDIR /web

# Empty = same-origin relative /api (nginx proxies to backend). Override in Coolify build args if needed.
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    GENERATE_SOURCEMAP=false \
    NODE_OPTIONS=--max-old-space-size=2048 \
    DISABLE_ESLINT_PLUGIN=true

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY . .
RUN yarn build

# Stage 2: serve with nginx (SPA + /api reverse proxy)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/build /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
