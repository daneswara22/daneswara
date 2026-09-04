'use client';

// Turn any media URL into a URL the browser can safely draw into a <canvas>.
//
// Receipts (ESC/POS raster + html2canvas share cards) read pixels back from a canvas.
// A cross-origin image without Access-Control-Allow-Origin taints the canvas and the
// read throws, which used to make the shop logo silently vanish from receipts after the
// images moved from base64 data URIs to the Cloudflare R2 CDN.
//
// Anything already same-origin, relative, or a data/blob URI is returned untouched;
// remote URLs are routed through /api/media so they become same-origin.
export function canvasSafeUrl(url?: string | null): string {
  if (!url) return '';
  const value = String(url).trim();
  if (!value) return '';

  // data:, blob: and relative/protocol-less paths are already safe.
  if (value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (!/^https?:\/\//i.test(value)) return value;

  if (typeof window !== 'undefined') {
    try {
      if (new URL(value).origin === window.location.origin) return value;
    } catch {
      return value;
    }
  }

  return `/api/media?url=${encodeURIComponent(value)}`;
}

export default canvasSafeUrl;
