import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { handle } from '@/lib/handler';

export const dynamic = 'force-dynamic';

const MANIFEST = path.join(process.cwd(), 'public', 'cliparts', 'manifest.json');

// GET /api/cliparts -> clip-art asset library (searchable). Public to authed editor.
export const GET = handle(async (_req: NextRequest) => {
  try {
    const raw = await fs.readFile(MANIFEST, 'utf-8');
    const items = JSON.parse(raw);
    const categories = Array.from(new Set(items.map((i: any) => i.category))).sort();
    return { items, categories, total: items.length };
  } catch {
    return { items: [], categories: [], total: 0 };
  }
});
