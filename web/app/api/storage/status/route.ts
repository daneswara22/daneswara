import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { storage } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    await getCurrentUser(req);
    return NextResponse.json({ backend: storage.backend });
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Unauthorized' }, { status: e?.status || 401 });
  }
}
