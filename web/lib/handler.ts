// Route handler wrapper: catches errors, applies Zod validation, returns JSON.
import { NextRequest, NextResponse } from 'next/server';
import { AuthError } from './auth';
import { HttpError } from './http';

type Handler = (req: NextRequest, ctx: any) => Promise<Response | any>;

export function handle(fn: Handler): (req: NextRequest, ctx: any) => Promise<Response> {
  return async (req: NextRequest, ctx: any) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out);
    } catch (err: any) {
      if (err instanceof AuthError) return NextResponse.json({ detail: err.message }, { status: err.status });
      if (err instanceof HttpError) return NextResponse.json({ detail: err.message }, { status: err.status });
      if (err?.name === 'ZodError') {
        return NextResponse.json({ detail: err.issues?.[0]?.message || 'Validation error' }, { status: 400 });
      }
      const msg = err?.message || 'Internal server error';
      console.error('[api]', msg, err?.stack);
      const status = /not found/i.test(msg) ? 404 : 500;
      return NextResponse.json({ detail: msg }, { status });
    }
  };
}

export async function readBody(req: NextRequest): Promise<any> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await req.json();
  if (ct.includes('application/x-www-form-urlencoded')) {
    const t = await req.text();
    const p = new URLSearchParams(t);
    return Object.fromEntries(p);
  }
  return {};
}
