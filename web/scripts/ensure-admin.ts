// Idempotently ensure an Owner account exists for testing/recovery.
// Usage: cd /app/web && npx tsx scripts/ensure-admin.ts [username] [password]
import 'dotenv/config';
import crypto from 'crypto';
import { prisma } from '../lib/db';
import { hashPassword } from '../lib/auth';

async function main() {
  const username = process.argv[2] || process.env.OWNER_USERNAME || 'admin';
  const password = process.argv[3] || process.env.OWNER_PASSWORD;
  if (!password) {
    throw new Error(
      'No password provided. Pass it as an argument or set OWNER_PASSWORD in the environment:\n' +
        "  npx tsx scripts/ensure-admin.ts admin 'YourNewPassword123!'",
    );
  }

  const tenant = await prisma.tenants.findFirst();
  if (!tenant) throw new Error('No tenant found in database.');

  const hash = await hashPassword(password);
  const existing = await prisma.users.findFirst({ where: { username } });

  if (existing) {
    await prisma.users.update({
      where: { id: existing.id },
      data: { password_hash: hash, role: 'Owner', active: true },
    });
    console.log(`Updated existing user "${username}" (role=Owner, active=true).`);
  } else {
    await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenant.id,
        username,
        password_hash: hash,
        name: 'Owner',
        role: 'Owner',
        active: true,
        created_at: new Date(),
      },
    });
    console.log(`Created Owner user "${username}" on tenant "${tenant.name}".`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
