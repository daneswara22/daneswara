#!/bin/bash
# Entrypoint for the single-container image: run the FastAPI API in the background, nginx in the foreground.
set -e
cd /srv

uvicorn server:app --host 127.0.0.1 --port "${API_PORT:-8001}" --proxy-headers --forwarded-allow-ips='*' --workers "${API_WORKERS:-2}" &
API_PID=$!

# Stop everything if either process dies
trap 'kill -TERM $API_PID 2>/dev/null; nginx -s quit 2>/dev/null; exit 0' TERM INT

# Wait for the API to accept connections (DB may still be warming up; uvicorn retries internally)
for i in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:${API_PORT:-8001}/health" >/dev/null 2>&1 && break
  sleep 2
done

nginx -g 'daemon off;' &
NGINX_PID=$!

wait -n $API_PID $NGINX_PID
EXIT=$?
kill -TERM $API_PID $NGINX_PID 2>/dev/null || true
exit $EXIT
