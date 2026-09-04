// POC test script: verify Prisma DB access + storage upload + auth (bcrypt+jwt) + gallery data + WebP conversion.
// Run: cd /app/web && yarn test:core
import 'dotenv/config';
import { prisma } from '../lib/db';
import { storage } from '../lib/storage';
import { hashPassword, verifyPassword, createAccessToken, verifyAccessToken } from '../lib/auth';
import sharp from 'sharp';

async function runTest(name: string, fn: () => Promise<any>) {
  process.stdout.write(`\u25b6 ${name} ... `);
  try {
    const result = await fn();
    console.log('OK', result ? `\n   \u2192 ${JSON.stringify(result).slice(0, 200)}` : '');
    return true;
  } catch (e: any) {
    console.error('FAIL');
    console.error('  ', e?.message || e);
    return false;
  }
}

async function main() {
  const results: { name: string; pass: boolean }[] = [];

  results.push({ name: 'Prisma connect + 18 tables', pass: await runTest('Prisma connect + 18 tables', async () => {
    const t = await prisma.$queryRawUnsafe<any>('SHOW TABLES');
    if (!Array.isArray(t) || t.length < 18) throw new Error(`expected \u226518 tables, got ${t?.length}`);
    return { tables: t.length };
  })});

  results.push({ name: 'Query tenants + users', pass: await runTest('Query tenants + users', async () => {
    const tenants = await prisma.tenants.count();
    const users = await prisma.users.count();
    return { tenants, users };
  })});

  results.push({ name: 'Query gallery_items', pass: await runTest('Query gallery_items', async () => {
    const rows = await prisma.gallery_items.findMany({ take: 5, orderBy: [{ sort_order: 'desc' }] });
    return { count: rows.length, first_label: rows[0]?.label || null };
  })});

  results.push({ name: 'bcrypt hash + verify', pass: await runTest('bcrypt hash + verify', async () => {
    const h = await hashPassword('TestPass123!');
    const ok = await verifyPassword('TestPass123!', h);
    if (!ok) throw new Error('verify failed');
    // verify against a known $2b$ python hash (test compatibility) - create with cost 10
    return { hash_prefix: h.slice(0, 4), verify: ok };
  })});

  results.push({ name: 'JWT sign + verify', pass: await runTest('JWT sign + verify', async () => {
    const tok = await createAccessToken('user-1', 'tenant-1', 'Owner');
    const p = await verifyAccessToken(tok);
    if (!p || p.sub !== 'user-1') throw new Error('payload mismatch');
    return { role: p.role, tid: p.tid };
  })});

  results.push({ name: 'sharp WebP conversion', pass: await runTest('sharp WebP conversion', async () => {
    const raw = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 128, b: 0 } } }).png().toBuffer();
    const info = await storage.uploadImage(raw, 'gallery');
    if (!info.url) throw new Error('no url returned');
    return { url: info.url, backend: info.backend, bytes: info.bytes, w: info.width, h: info.height };
  })});

  results.push({ name: 'Storage backend detection', pass: await runTest('Storage backend detection', async () => {
    return { backend: storage.backend };
  })});

  console.log('\n\u2500\u2500\u2500 Summary \u2500\u2500\u2500');
  for (const r of results) console.log((r.pass ? '\u2705' : '\u274c') + ' ' + r.name);
  const allPass = results.every(r => r.pass);
  console.log(allPass ? '\n\ud83c\udf89 All POC tests passed.' : '\n\ud83d\udea8 Some POC tests failed.');
  await prisma.$disconnect();
  process.exit(allPass ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
