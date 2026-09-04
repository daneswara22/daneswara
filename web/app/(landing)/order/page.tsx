'use client';
import { Suspense } from 'react';
import Order from '@/landing/pages/Order';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Order />
    </Suspense>
  );
}
