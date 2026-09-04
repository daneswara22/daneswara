// Env config for Next.js server - do not import from client components
export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_EXPIRE_DAYS: parseInt(process.env.JWT_EXPIRE_DAYS || '7', 10),
  COOKIE_SECURE: (process.env.COOKIE_SECURE || 'true').toLowerCase() === 'true',

  OWNER_USERNAME: process.env.OWNER_USERNAME || 'admin',
  OWNER_PASSWORD: process.env.OWNER_PASSWORD || 'ChangeMe123!',
  OWNER_NAME: process.env.OWNER_NAME || 'Owner',
  OWNER_BUSINESS: process.env.OWNER_BUSINESS || 'Daneswara Print',

  SEED_CATALOG: (process.env.SEED_CATALOG || 'true').toLowerCase() === 'true',
  SEED_CUSTOMERS: (process.env.SEED_CUSTOMERS || 'true').toLowerCase() === 'true',
  SEED_GALLERY: (process.env.SEED_GALLERY || 'true').toLowerCase() === 'true',

  TIMEZONE: process.env.TIMEZONE || 'Asia/Makassar',
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),

  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET: process.env.R2_BUCKET || '',
  R2_ENDPOINT: (process.env.R2_ENDPOINT || '').replace(/\/$/, ''),
  R2_PUBLIC_BASE_URL: (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  R2_PREFIX: (process.env.R2_PREFIX || 'daneswara').replace(/^\/+|\/+$/g, ''),

  UPLOAD_DIR: process.env.UPLOAD_DIR || '/tmp/daneswara-uploads',

  get r2Endpoint(): string {
    return this.R2_ENDPOINT || `https://${this.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  },
  get r2Enabled(): boolean {
    return Boolean(this.R2_ACCESS_KEY_ID && this.R2_SECRET_ACCESS_KEY && this.R2_BUCKET && (this.R2_ENDPOINT || this.R2_ACCOUNT_ID));
  },
};
