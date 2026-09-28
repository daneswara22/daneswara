import { NextRequest } from 'next/server';
import fsSync, { promises as fs } from 'fs';
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
const SCRIPT_CANDIDATES = [
  path.join(process.cwd(), '..', 'scripts', 'process_clipart_sheet.py'),
  '/app/scripts/process_clipart_sheet.py',
];

// The interpreter must have numpy/scipy/Pillow. The sandbox venv is the usual one,
// but it may be missing (or not executable) on other hosts, so probe candidates
// instead of hardcoding a single path -> that is what caused "spawn ... EACCES".
function resolvePython(): string {
  const candidates = [
    process.env.CLIPART_PYTHON,
    '/root/.venv/bin/python3',
    '/usr/local/bin/python3',
    '/usr/bin/python3',
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      fsSync.accessSync(c, fsSync.constants.X_OK);
      return c;
    } catch {
      /* try next */
    }
  }
  return 'python3'; // last resort: whatever is on PATH
}

function resolveScript(): string {
  for (const c of SCRIPT_CANDIDATES) {
    try {
      fsSync.accessSync(c, fsSync.constants.R_OK);
      return c;
    } catch {
      /* try next */
    }
  }
  return SCRIPT_CANDIDATES[SCRIPT_CANDIDATES.length - 1];
}

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
    const python = resolvePython();
    const script = resolveScript();
    const args = [script, sheetPath, CLIP_DIR, '--dilate', '2', '--minarea', '400', '--start-index', String(startIndex)];
    const proc = spawn(python, args, { env: process.env });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (err += d.toString()));
    proc.on('error', (e: any) => {
      reject(
        new Error(
          `Tidak bisa menjalankan pemroses gambar (${python}: ${e?.code || e?.message}). ` +
            'Set CLIPART_PYTHON ke interpreter Python yang punya numpy, scipy, dan Pillow.',
        ),
      );
    });
    proc.on('close', (code) => {
      if (code === 0) return resolve(out);
      const detail = (err || out || '').trim();
      if (/ModuleNotFoundError|ImportError/.test(detail)) {
        const mod = detail.match(/No module named '([^']+)'/)?.[1] || 'numpy/scipy/Pillow';
        return reject(new Error(`Pemroses gambar butuh modul Python "${mod}". Jalankan: pip install numpy scipy pillow`));
      }
      reject(new Error(`Processor gagal (exit ${code}): ${detail}`));
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
