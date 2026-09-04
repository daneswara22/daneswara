// Timezone helper (Asia/Makassar by default) for reports and date grouping.
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { env } from './env';

export function now(): Date {
  return new Date();
}

export function toISO(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

export function tzFormat(d: Date, pattern: string): string {
  return formatInTimeZone(d, env.TIMEZONE, pattern);
}

export function tzStartOfDay(d: Date): Date {
  const s = formatInTimeZone(d, env.TIMEZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${s} 00:00:00`, env.TIMEZONE);
}

export function tzEndOfDay(d: Date): Date {
  const s = formatInTimeZone(d, env.TIMEZONE, 'yyyy-MM-dd');
  return fromZonedTime(`${s} 23:59:59.999`, env.TIMEZONE);
}

export function tzDateKey(d: Date): string {
  return formatInTimeZone(d, env.TIMEZONE, 'yyyy-MM-dd');
}

export function tzMonthKey(d: Date): string {
  return formatInTimeZone(d, env.TIMEZONE, 'yyyy-MM');
}

export function parseDateInTz(input: string): Date {
  // Accepts 'YYYY-MM-DD' or ISO; interprets bare date as local (Makassar) day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return fromZonedTime(`${input} 00:00:00`, env.TIMEZONE);
  }
  return new Date(input);
}

export { formatInTimeZone, toZonedTime, fromZonedTime };
