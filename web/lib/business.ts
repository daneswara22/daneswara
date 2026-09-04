// Business logic helpers shared across route handlers (mirrors Python utils.py)
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { env } from './env';

export function newId(): string {
  return crypto.randomUUID();
}

export function utcNow(): Date {
  return new Date();
}

export function toIsoUtc(d: Date | null | undefined): string | null {
  if (!d) return null;
  return (d instanceof Date ? d : new Date(d as any)).toISOString();
}

export function localNow(): Date {
  // date in local (Makassar) zone as "clock time" for formatting; keep as Date obj for compat
  return new Date();
}

export function localToday(): string {
  return formatInTimeZone(new Date(), env.TIMEZONE, 'yyyy-MM-dd');
}

export function localDateOf(dt: Date | null | undefined): string | null {
  if (!dt) return null;
  return formatInTimeZone(dt instanceof Date ? dt : new Date(dt), env.TIMEZONE, 'yyyy-MM-dd');
}

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const trimmed = String(s).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(trimmed + 'T00:00:00.000Z');
  return isNaN(d.getTime()) ? null : d;
}

// Convert YYYY-MM-DD range in local TZ -> UTC Date objects for SQL comparison.
export function localRangeToUtc(start?: string | null, end?: string | null): { s: Date | null; e: Date | null } {
  const s = start ? parseDate(start) : null;
  const e = end ? parseDate(end) : null;
  let sUtc: Date | null = null;
  let eUtc: Date | null = null;
  if (s) {
    const key = formatInTimeZone(s, 'UTC', 'yyyy-MM-dd');
    sUtc = fromZonedTime(`${key} 00:00:00`, env.TIMEZONE);
  }
  if (e) {
    const key = formatInTimeZone(e, 'UTC', 'yyyy-MM-dd');
    const eEnd = fromZonedTime(`${key} 00:00:00`, env.TIMEZONE);
    eUtc = new Date(eEnd.getTime() + 86400_000);
  }
  return { s: sUtc, e: eUtc };
}

export function docNumber(prefix: string, count: number): string {
  const y = formatInTimeZone(new Date(), env.TIMEZONE, 'yyMMdd');
  return `${prefix}-${y}-${String(count + 1).padStart(4, '0')}`;
}

export function rp(n: number): string {
  return 'Rp' + Math.round(n || 0).toLocaleString('id-ID');
}

export function safeJsonParse<T = any>(value: any, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
}

// For MariaDB DATETIME columns we store naive UTC (no TZ) so that Python and Node backends align.
export function mysqlDateTime(d: Date = new Date()): Date {
  return d;
}
