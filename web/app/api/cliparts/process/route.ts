import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { requireRoles, logActivity } from '@/lib/auth';
import { handle, readBody } from '@/lib/handler';
import { HttpError } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CLIP_DIR = path.join(process.cwd(), 'public', 'cliparts');
const MANIFEST = path.join(CLIP_DIR, 'manifest.json');
const SCRIPT = '/app/scripts/process_clipart_sheet.py';
// Use the venv python that has numpy/scipy/Pillow (Next server PATH may differ).
const PYTHON = process.env.CLIPART_PYTHON || '/root/.venv/bin/python3';

async function readManifest(): Promise<any[]> {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, 'utf-8'));
  } catch {
    return [];
  }
}

function nextIndex(manifest: any[]): number {
  let max = 0;
  for (const m of manifest) {
    const n = parseInt(String(m.id).split('-').pop() || '0', 10);
    if (n > max) max = n;
  }
  return max + 1;
}

function runProcessor(sheetPath: string, startIndex: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [SCRIPT, sheetPath, CLIP_DIR, '--dilate', '2', '--minarea', '400', '--start-index', String(startIndex)];
    const proc = spawn(PYTHON, args, { env: process.env });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`Processor gagal (exit ${code}): ${err || out}`));
    });
  });
}

// POST /api/cliparts/process  { image: dataUri }  (Owner/Manager)
// Segments an uploaded clip-art sheet into individual transparent PNG assets.
export const POST = handle(async (req: NextRequest) => {
  const user = await requireRoles(req, 'Owner', 'Manager');
  const body = await readBody(req);
  const image: string = (body?.image || '').toString();
  if (!image.startsWith('data:image/')) {
    throw new HttpError(400, 'Unggah file gambar (PNG/JPG) berisi kumpulan clip art.');
  }
  const b64 = image.split(',')[1] || '';
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 1000) throw new HttpError(400, 'File gambar tidak valid.');
  if (buf.length > 20 * 1024 * 1024) throw new HttpError(400, 'Ukuran gambar terlalu besar (maks 20MB).');

  await fs.mkdir(CLIP_DIR, { recursive: true });
  const tmp = path.join(os.tmpdir(), `clipsheet_${Date.now()}.png`);
  await fs.writeFile(tmp, buf);

  const manifest = await readManifest();
  const start = nextIndex(manifest);

  try {
    await runProcessor(tmp, start);
  } finally {
    fs.unlink(tmp).catch(() => {});
    fs.unlink(path.join(CLIP_DIR, '_montage.png')).catch(() => {});
  }

  // read the assets produced by this run
  let produced: any[] = [];
  try {
    produced = JSON.parse(await fs.readFile(path.join(CLIP_DIR, 'assets.json'), 'utf-8'));
  } catch {
    produced = [];
  }

  const added = produced.map((a: any) => ({
    id: a.id,
    filename: a.filename,
    name: `Clipart ${String(a.id).split('-').pop()}`,
    category: 'Uncategorized',
    tags: ['uncategorized'],
    url: a.url,
    thumb: a.thumb,
    width: a.width,
    height: a.height,
    aspectRatio: a.aspectRatio,
  }));

  if (added.length === 0) {
    throw new HttpError(422, 'Tidak ada clip art yang terdeteksi pada gambar. Pastikan latar terang & tiap gambar terpisah.');
  }

  const updated = [...manifest, ...added];
  await fs.writeFile(MANIFEST, JSON.stringify(updated, null, 2));
  await logActivity(user.tenant_id, user, 'Proses Sheet Clip Art', `${added.length} aset baru`);

  return { added, total: updated.length };
});
