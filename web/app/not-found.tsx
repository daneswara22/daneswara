import type { Metadata } from 'next';
import Link from 'next/link';

// The original CRA dashboard had `<Route path="*" element={<Navigate to="/" replace />} />`,
// so an unknown URL always landed the visitor somewhere useful. After the Next.js migration
// unknown URLs fell through to Next's bare, unbranded 404. This restores a branded page that
// matches the print-shop landing theme and offers the same "go home" escape hatch.

export const metadata: Metadata = {
  title: 'Halaman tidak ditemukan',
  robots: { index: false, follow: false },
};

const INK = '#1A1A1A';
const CREAM = '#F4F1EA';
const BRICK = '#C84B31';

export default function NotFound() {
  return (
    <div
      data-testid="not-found-page"
      style={{
        minHeight: '100vh',
        backgroundColor: CREAM,
        color: INK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        fontFamily: "'Work Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 620, width: '100%', textAlign: 'center' }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: BRICK,
            margin: 0,
          }}
        >
          Error 404
        </p>

        <h1
          style={{
            fontFamily: "'Anton', Impact, sans-serif",
            fontSize: 'clamp(56px, 16vw, 132px)',
            lineHeight: 0.92,
            letterSpacing: '0.02em',
            margin: '10px 0 0',
          }}
        >
          SALAH CETAK.
        </h1>

        <p style={{ marginTop: 18, fontSize: 17, lineHeight: 1.6 }}>
          Halaman yang kamu cari tidak ada atau sudah dipindahkan.
          <br />
          <span style={{ opacity: 0.65, fontSize: 15 }}>
            The page you are looking for does not exist or has been moved.
          </span>
        </p>

        <div
          style={{
            marginTop: 32,
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Link
            href="/"
            data-testid="not-found-home-link"
            style={{
              display: 'inline-block',
              padding: '14px 26px',
              backgroundColor: BRICK,
              color: '#fff',
              border: `2px solid ${INK}`,
              boxShadow: `4px 4px 0 0 ${INK}`,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Kembali ke Beranda
          </Link>

          <Link
            href="/galeri"
            data-testid="not-found-gallery-link"
            style={{
              display: 'inline-block',
              padding: '14px 26px',
              backgroundColor: '#F9F7F2',
              color: INK,
              border: `2px solid ${INK}`,
              boxShadow: `4px 4px 0 0 ${INK}`,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Lihat Galeri
          </Link>

          <Link
            href="/login"
            data-testid="not-found-login-link"
            style={{
              display: 'inline-block',
              padding: '14px 26px',
              backgroundColor: '#F9F7F2',
              color: INK,
              border: `2px solid ${INK}`,
              boxShadow: `4px 4px 0 0 ${INK}`,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Masuk DanesPOS
          </Link>
        </div>
      </div>
    </div>
  );
}
