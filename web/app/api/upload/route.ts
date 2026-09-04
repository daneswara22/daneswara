import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { storage, IMAGE_PROFILES } from '@/lib/storage';
import { errorResponse } from '@/lib/http';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    await getCurrentUser(req);
    const url = new URL(req.url);
    let kind = url.searchParams.get('kind') || 'misc';
    if (!IMAGE_PROFILES[kind]) kind = 'misc';

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file || typeof file === 'string') {
      return NextResponse.json({ detail: 'File wajib dilampirkan' }, { status: 400 });
    }
    if (!(file.type || '').startsWith('image/')) {
      return NextResponse.json({ detail: 'File harus berupa gambar' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ detail: 'Ukuran gambar maksimal 15MB' }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const info = await storage.uploadImage(buf, kind);
    return NextResponse.json(info);
  } catch (e) {
    return errorResponse(e);
  }
}
