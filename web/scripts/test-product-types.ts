/**
 * POC / regression test untuk fitur "Jenis Produk".
 * Membuktikan rantai paling rawan dalam satu jalan:
 *   1. Seed 3 jenis kaos bawaan (idempotent).
 *   2. CREATE jenis produk baru + pastikan product_key unik.
 *   3. Upload gambar PNG -> otomatis jadi WebP di R2 (dipakai thumbnail produk).
 *   4. CRUD varian warna (termasuk thumbnail tampak depan) + tolak hex duplikat.
 *   5. CRUD size chart (lebar dada & panjang) + tolak label duplikat.
 *   6. Pagination/lazy-load list produk (page 1 & 2).
 *   7. Endpoint publik hanya mengembalikan produk aktif.
 *   8. DELETE produk -> warna & size chart ikut terhapus (cascade).
 *
 * Jalankan: cd /app/web && npx tsx scripts/test-product-types.ts
 * Semua data uji diawali ZZ_TEST_ dan dihapus lagi di akhir (aman untuk DB hidup).
 */
import 'dotenv/config';
import sharp from 'sharp';
import { prisma } from '../lib/db';
import { seedOwner } from '../lib/seed';
import { storage } from '../lib/storage';
import { newId } from '../lib/http';
import { slugifyProductKey } from '../lib/productTypes';
import { listProductTypes, ensureSeedProductTypes, getProductTypeById } from '../lib/productTypeQueries';
import { serializeProductType } from '../lib/serializers';

const results: { name: string; ok: boolean; info?: any; err?: string }[] = [];
const TEST_PREFIX = 'ZZ_TEST_';

async function step(name: string, fn: () => Promise<any>) {
  process.stdout.write(`\u25b6 ${name} ... `);
  try {
    const info = await fn();
    results.push({ name, ok: true, info });
    console.log('OK', '');
    if (info !== undefined) console.log('   \u2192', JSON.stringify(info));
    return info;
  } catch (e: any) {
    results.push({ name, ok: false, err: e?.message });
    console.log('FAIL\n   \u2192', e?.message);
    return null;
  }
}

async function main() {
  const owner = await seedOwner();
  const tid = owner.tenant_id;
  let productId = '';
  let colorId = '';
  let sizeId = '';
  let uploadedUrl = '';

  await step('Seed 4 jenis kaos bawaan (idempotent)', async () => {
    await ensureSeedProductTypes(tid);
    const count = await prisma.custom_products.count({ where: { tenant_id: tid } });
    const again = await ensureSeedProductTypes(tid);
    if (count < 4) throw new Error(`hanya ${count} jenis produk, harus >= 4`);
    if (again !== 0) throw new Error(`seed tidak idempotent (masih mengubah ${again} baris)`);
    return { products: count, idempotent: true };
  });

  await step('Upload PNG -> WebP (thumbnail produk)', async () => {
    const png = await sharp({
      create: { width: 400, height: 400, channels: 4, background: { r: 30, g: 41, b: 59, alpha: 1 } },
    })
      .png()
      .toBuffer();
    const info = await storage.uploadImage(png, 'mockup');
    if (!info.url || !/\.webp($|\?)/.test(info.url)) throw new Error(`URL bukan webp: ${info.url}`);
    uploadedUrl = info.url;
    return { url: info.url, backend: info.backend, bytes: info.bytes };
  });

  await step('CREATE jenis produk', async () => {
    const now = new Date();
    const title = `${TEST_PREFIX}Kaos Uji Otomatis`;
    const row = await prisma.custom_products.create({
      data: {
        id: newId(),
        tenant_id: tid,
        product_key: slugifyProductKey(title),
        title,
        subtitle: 'Dibuat oleh test-product-types.ts',
        description: 'Data uji, akan dihapus otomatis.',
        price: 65000,
        supplier: 'ZZ_TEST_Supplier',
        size_region: 'Asia / Local Size',
        model: 'Kaos reguler',
        material: 'Cotton 30s',
        thumbnail_url: uploadedUrl || null,
        size_guide_url: null,
        sizes_json: '[]',
        specs_json: '[]',
        is_active: true,
        sort_order: 999,
        created_at: now,
        updated_at: now,
      },
    });
    productId = row.id;
    return { id: row.id, product_key: row.product_key, price: row.price };
  });

  await step('CREATE + UPDATE varian warna (dengan thumbnail)', async () => {
    const now = new Date();
    const c = await prisma.custom_product_colors.create({
      data: {
        id: newId(),
        tenant_id: tid,
        product_id: productId,
        name: 'Hitam Uji',
        hex: '#111111',
        thumb_url: uploadedUrl || null,
        sort_order: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });
    colorId = c.id;
    const upd = await prisma.custom_product_colors.update({
      where: { id: colorId },
      data: { name: 'Hitam Uji (edit)', updated_at: new Date() },
    });
    // warna kedua supaya color_count = 2
    await prisma.custom_product_colors.create({
      data: {
        id: newId(),
        tenant_id: tid,
        product_id: productId,
        name: 'Putih Uji',
        hex: '#FFFFFF',
        thumb_url: null,
        sort_order: 10,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });
    if (!upd.name.includes('edit')) throw new Error('update warna gagal');
    return { color_id: colorId, name: upd.name, has_thumb: !!upd.thumb_url };
  });

  await step('Tolak hex warna duplikat (unique constraint)', async () => {
    const now = new Date();
    try {
      await prisma.custom_product_colors.create({
        data: {
          id: newId(),
          tenant_id: tid,
          product_id: productId,
          name: 'Duplikat',
          hex: '#111111',
          sort_order: 20,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      });
    } catch {
      return { rejected: true };
    }
    throw new Error('hex duplikat seharusnya ditolak');
  });

  await step('CREATE + UPDATE size chart (lebar dada & panjang)', async () => {
    const now = new Date();
    const s = await prisma.custom_product_sizes.create({
      data: {
        id: newId(),
        tenant_id: tid,
        product_id: productId,
        label: 'L',
        chest_cm: 52,
        length_cm: 72,
        sort_order: 30,
        created_at: now,
        updated_at: now,
      },
    });
    sizeId = s.id;
    const upd = await prisma.custom_product_sizes.update({
      where: { id: sizeId },
      data: { chest_cm: 53.5, length_cm: 73, updated_at: new Date() },
    });
    if (Number(upd.chest_cm) !== 53.5) throw new Error(`chest_cm tidak tersimpan: ${upd.chest_cm}`);
    return { size_id: sizeId, label: upd.label, chest_cm: upd.chest_cm, length_cm: upd.length_cm };
  });

  await step('Tolak label ukuran duplikat', async () => {
    const now = new Date();
    try {
      await prisma.custom_product_sizes.create({
        data: {
          id: newId(),
          tenant_id: tid,
          product_id: productId,
          label: 'L',
          chest_cm: 1,
          length_cm: 1,
          sort_order: 40,
          created_at: now,
          updated_at: now,
        },
      });
    } catch {
      return { rejected: true };
    }
    throw new Error('label ukuran duplikat seharusnya ditolak');
  });

  await step('Serializer: warna + size chart menempel di produk', async () => {
    const row = await getProductTypeById(productId, tid);
    if (!row) throw new Error('produk tidak ditemukan');
    const s = serializeProductType(row);
    if (s.color_count !== 2) throw new Error(`color_count ${s.color_count}, harus 2`);
    if (s.sizes.length !== 1) throw new Error(`sizes ${JSON.stringify(s.sizes)}`);
    return { color_count: s.color_count, sizes: s.sizes, price: s.price };
  });

  await step('Pagination / lazy load (limit 2, page 1 & 2)', async () => {
    const p1 = await listProductTypes({ tenantId: tid, page: 1, limit: 2 });
    const p2 = await listProductTypes({ tenantId: tid, page: 2, limit: 2 });
    if (p1.items.length !== 2) throw new Error(`page1 = ${p1.items.length} item`);
    if (!p1.has_more) throw new Error('has_more page1 harus true');
    const overlap = p1.items.some((a) => p2.items.some((b) => b.id === a.id));
    if (overlap) throw new Error('page 1 dan 2 tumpang tindih');
    return { total: p1.total, pages: p1.pages, page1: p1.items.length, page2: p2.items.length };
  });

  await step('Pencarian (q) menemukan produk uji', async () => {
    const found = await listProductTypes({ tenantId: tid, page: 1, limit: 10, q: TEST_PREFIX });
    if (found.total < 1) throw new Error('produk uji tidak ditemukan lewat q');
    return { total: found.total, first: found.items[0]?.title };
  });

  await step('Endpoint publik hanya produk aktif', async () => {
    await prisma.custom_products.update({ where: { id: productId }, data: { is_active: false } });
    const pub = await listProductTypes({ page: 1, limit: 50, activeOnly: true });
    const leaked = pub.items.find((i) => i.id === productId);
    await prisma.custom_products.update({ where: { id: productId }, data: { is_active: true } });
    if (leaked) throw new Error('produk non-aktif bocor ke endpoint publik');
    return { active_visible: pub.total };
  });

  await step('DELETE produk -> warna & size ikut terhapus (cascade)', async () => {
    await prisma.custom_products.delete({ where: { id: productId } });
    const c = await prisma.custom_product_colors.count({ where: { product_id: productId } });
    const s = await prisma.custom_product_sizes.count({ where: { product_id: productId } });
    if (c !== 0 || s !== 0) throw new Error(`cascade gagal: colors=${c} sizes=${s}`);
    if (uploadedUrl) await storage.delete(uploadedUrl).catch(() => {});
    return { colors_left: c, sizes_left: s };
  });

  // Bersih-bersih kalau ada sisa data uji
  await prisma.custom_products.deleteMany({ where: { tenant_id: tid, title: { startsWith: TEST_PREFIX } } });

  console.log('\n\u2500\u2500\u2500 Summary \u2500\u2500\u2500');
  for (const r of results) console.log(`${r.ok ? '\u2705' : '\u274c'} ${r.name}${r.ok ? '' : ' \u2014 ' + r.err}`);
  const failed = results.filter((r) => !r.ok);
  await prisma.$disconnect();
  if (failed.length) {
    console.log(`\n\u274c ${failed.length} test gagal.`);
    process.exit(1);
  }
  console.log('\n\ud83c\udf89 Semua test Jenis Produk lulus.');
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
