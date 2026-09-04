"""Preview bridge: minimal FastAPI proxy that forwards /api/* -> Next.js on port 3000.
Supervisor keeps this running as 'backend' program. Used ONLY in the Emergent sandbox
where ingress routes /api -> 8001 while Next.js runs on 3000. Not used in Coolify prod
(the standalone Next.js Dockerfile serves both pages and API on the same port).
"""
import os
import asyncio
import logging
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger('bridge')

NEXT_URL = os.environ.get('NEXT_URL', 'http://127.0.0.1:3000')

app = FastAPI(title='Daneswara Preview Bridge')

# Wait for Next.js to be up before starting to serve.
@app.on_event('startup')
async def wait_for_next():
    log.info('Waiting for Next.js at %s ...', NEXT_URL)
    for i in range(60):
        try:
            async with httpx.AsyncClient(timeout=2.0) as c:
                r = await c.get(NEXT_URL + '/api/health')
                if r.status_code < 500:
                    log.info('Next.js reachable (status=%s) after %ds', r.status_code, i)
                    return
        except Exception:
            pass
        await asyncio.sleep(1)
    log.warning('Next.js did not respond within 60s; bridge will still try to forward.')


@app.get('/health')
async def bridge_health():
    return {'status': 'ok', 'proxy_to': NEXT_URL}


async def proxy(request: Request, path: str) -> Response:
    url = f"{NEXT_URL}/api/{path}"
    method = request.method
    body = await request.body()
    hop_by_hop = {'host', 'content-length', 'connection', 'accept-encoding'}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in hop_by_hop}
    params = dict(request.query_params)
    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=False) as c:
            r = await c.request(method, url, content=body, headers=headers, params=params)
        resp_headers = {k: v for k, v in r.headers.items() if k.lower() not in {'content-length', 'transfer-encoding', 'connection'}}
        return Response(content=r.content, status_code=r.status_code, headers=resp_headers, media_type=r.headers.get('content-type'))
    except httpx.ConnectError:
        return Response(content='{"detail":"Backend Next.js not reachable"}', status_code=502, media_type='application/json')
    except Exception as e:
        log.exception('proxy error')
        return Response(content=f'{{"detail":"proxy error: {e}"}}', status_code=500, media_type='application/json')


# Wildcard route to forward everything /api/* to Next.js
@app.api_route('/api/{path:path}', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
async def api_proxy(request: Request, path: str):
    return await proxy(request, path)


# Root - useful for supervisor readiness probes
@app.get('/')
async def root():
    return {'service': 'daneswara-preview-bridge', 'proxy_to': NEXT_URL}
