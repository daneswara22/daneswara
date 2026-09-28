// Lapisan pemetaan status Shopee -> status internal.
// Status asli Shopee TIDAK dipakai langsung di UI; disimpan di
// orders.external_status supaya perubahan API Shopee tidak merusak aplikasi.
import { InternalStatus, LEGACY_STATUS_BY_INTERNAL } from '../types';

const MAP: Record<string, InternalStatus> = {
  UNPAID: 'NEW',
  PENDING: 'NEW',
  INVOICE_PENDING: 'NEW',
  READY_TO_SHIP: 'PAID',
  PROCESSED: 'PROCESSING',
  RETRY_SHIP: 'PROCESSING',
  TO_CONFIRM_RECEIVE: 'SHIPPED',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED',
  IN_CANCEL: 'PROCESSING',
  CANCELLED: 'CANCELLED',
  TO_RETURN: 'RETURNED',
};

export function mapShopeeStatus(shopeeStatus?: string | null): InternalStatus {
  const key = String(shopeeStatus || '').toUpperCase();
  return MAP[key] || 'PROCESSING';
}

export function legacyStatus(internal: InternalStatus): string {
  return LEGACY_STATUS_BY_INTERNAL[internal] || 'Proses';
}

export function mapPaymentStatus(shopeeStatus?: string | null): string {
  const key = String(shopeeStatus || '').toUpperCase();
  if (key === 'UNPAID' || key === 'PENDING' || key === 'INVOICE_PENDING') return 'UNPAID';
  if (key === 'CANCELLED') return 'CANCELLED';
  if (key === 'TO_RETURN') return 'REFUNDED';
  return 'PAID';
}

export function mapShippingStatus(detail: any): string {
  const pkg = Array.isArray(detail?.package_list) ? detail.package_list[0] : null;
  const logistic = String(pkg?.logistics_status || '').toUpperCase();
  if (logistic) return logistic;
  const key = String(detail?.order_status || '').toUpperCase();
  if (key === 'SHIPPED' || key === 'TO_CONFIRM_RECEIVE') return 'SHIPPED';
  if (key === 'COMPLETED') return 'DELIVERED';
  if (key === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}
