// Idempotent migration: tambah kolom fund_source (VARCHAR(40) NULL) ke tabel expenses & other_income.
// Aman dijalankan berkali-kali; hanya menambah kolom bila belum ada.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureColumn(table: string, column: string, def: string) {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column,
  )) as Array<{ COLUMN_NAME: string }>;
  if (rows.length > 0) {
    console.log(`  ok - ${table}.${column} sudah ada, dilewati`);
    return false;
  }
  await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
  console.log(`  + tambah ${table}.${column}`);
  return true;
}

async function main() {
  console.log('== Migrasi kolom fund_source ==');
  await ensureColumn('expenses', 'fund_source', 'VARCHAR(40) NULL');
  await ensureColumn('other_income', 'fund_source', 'VARCHAR(40) NULL');
  console.log('Selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
