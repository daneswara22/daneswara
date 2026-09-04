import bcrypt from 'bcryptjs';
async function main() {
  // Verify that bcryptjs can validate a Python bcrypt $2b$ hash of "Daneswara321!"
  const pyHash = '$2b$12$SAN0SYBDpkqlO97kE2Asu.Lhc6xWglk09Nuqe.MyV7CTCSq9ZPzQ2';
  const ok = await bcrypt.compare('Daneswara321!', pyHash);
  console.log('bcryptjs verify Python $2b$ hash:', ok);
  process.exit(ok ? 0 : 1);
}
main();
