// Small helpers used across route handlers.
import { NextResponse } from 'next/server';
import { AuthError } from './auth';

export function json(data: any, init?: ResponseInit): Response {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return NextResponse.json({ detail: err.message }, { status: err.status });
  }
  if (err instanceof HttpError) {
    return NextResponse.json({ detail: err.message }, { status: err.status });
  }
  console.error('API error:', err);
  const msg = (err as any)?.message || 'Internal server error';
  return NextResponse.json({ detail: msg }, { status: 500 });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function badRequest(msg: string): never {
  throw new HttpError(400, msg);
}
export function notFound(msg = 'Not found'): never {
  throw new HttpError(404, msg);
}
export function forbidden(msg = 'Akses ditolak'): never {
  throw new HttpError(403, msg);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

export function safeJson<T = any>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function stringifyJson(value: any): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null);
}
