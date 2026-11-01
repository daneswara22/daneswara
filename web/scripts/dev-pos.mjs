// Dev server POS di port 3001 dengan folder build terpisah (.next-pos) supaya
// tidak bentrok dengan dev server landing di port 3000 yang memakai .next.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const child = spawn(process.execPath, [nextBin, 'dev', '-p', '3001'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: '.next-pos' },
});
child.on('exit', (code) => process.exit(code ?? 0));
