'use client';

import { useEffect } from 'react';

/**
 * Next.js 15.1.6 mengunci badge dev indicator di kiri bawah lewat CSS di dalam
 * shadow DOM <nextjs-portal>, jadi tidak bisa diubah dari globals.css maupun
 * next.config.js (buildActivityPosition hanya untuk badge "building").
 * Komponen ini menyuntik override ke shadow root supaya badge pindah ke kanan.
 */
export default function DevIndicatorPosition() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const CSS = `
      .nextjs-toast {
        left: auto !important;
        right: var(--size-gap-double) !important;
      }
      @media (max-width: 440px) {
        .nextjs-toast { left: auto !important; right: 5vw !important; }
      }
    `;

    const apply = () => {
      const host = document.querySelector('nextjs-portal');
      const root = host?.shadowRoot;
      if (!root) return false;
      if (root.querySelector('style[data-dev-indicator-pos]')) return true;
      const style = document.createElement('style');
      style.setAttribute('data-dev-indicator-pos', '');
      style.textContent = CSS;
      root.appendChild(style);
      return true;
    };

    if (apply()) return;

    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
