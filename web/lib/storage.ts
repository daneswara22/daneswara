import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from './env';

// kind -> (max side px, webp quality)
export const IMAGE_PROFILES: Record<string, { max: number; quality: number }> = {
  gallery: { max: 1600, quality: 82 },
  product: { max: 800, quality: 80 },
  category: { max: 800, quality: 80 },
  logo: { max: 800, quality: 90 },
  misc: { max: 1600, quality: 82 },
};

const DATA_URI_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s;

export function decodeDataUri(uri: string): Buffer | null {
  const m = DATA_URI_RE.exec(uri.trim());
  if (!m) return null;
  try {
    return Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }
}

export async function toWebP(raw: Buffer, kind: string = 'misc'): Promise<{ buf: Buffer; width: number; height: number }> {
  const { max, quality } = IMAGE_PROFILES[kind] || IMAGE_PROFILES.misc;
  const image = sharp(raw, { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const long = Math.max(w, h);
  const resized = long > max ? image.resize({ width: w >= h ? max : undefined, height: h > w ? max : undefined, fit: 'inside', withoutEnlargement: true }) : image;
  const out = await resized.webp({ quality, effort: 6 }).toBuffer({ resolveWithObject: true });
  return { buf: out.data, width: out.info.width, height: out.info.height };
}

class StorageService {
  private client: S3Client | null = null;
  public backend: 'r2' | 'local' = 'local';

  constructor() {
    if (env.r2Enabled) {
      try {
        this.client = new S3Client({
          region: 'auto',
          endpoint: env.r2Endpoint,
          credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          },
          forcePathStyle: false,
        });
        this.backend = 'r2';
      } catch (e) {
        console.error('R2 client init failed, falling back to local:', e);
      }
    }
  }

  private buildKey(kind: string, ext = 'webp'): string {
    const prefix = env.R2_PREFIX ? `${env.R2_PREFIX}/` : '';
    return `${prefix}${kind}/${crypto.randomUUID()}.${ext}`;
  }

  publicUrl(key: string): string {
    if (this.backend === 'r2') {
      const base = env.R2_PUBLIC_BASE_URL || `${env.r2Endpoint}/${env.R2_BUCKET}`;
      return `${base}/${key}`;
    }
    return `${env.PUBLIC_BASE_URL}/api/files/${key}`;
  }

  keyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const marker = '/api/files/';
    if (url.includes(marker)) return url.split(marker)[1];
    if (this.backend === 'r2') {
      const base = env.R2_PUBLIC_BASE_URL || `${env.r2Endpoint}/${env.R2_BUCKET}`;
      if (base && url.startsWith(base + '/')) return url.slice(base.length + 1);
    }
    return null;
  }

  private async putObject(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.backend === 'r2' && this.client) {
      try {
        await this.client.send(
          new PutObjectCommand({
            Bucket: env.R2_BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
        return this.publicUrl(key);
      } catch (e) {
        console.error('R2 upload failed, writing to local:', e);
      }
    }
    // local fallback
    const abs = path.join(env.UPLOAD_DIR, key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body);
    return `${env.PUBLIC_BASE_URL || ''}/api/files/${key}`;
  }

  async uploadImage(raw: Buffer, kind: string = 'misc') {
    const { buf, width, height } = await toWebP(raw, kind);
    const key = this.buildKey(kind, 'webp');
    const url = await this.putObject(key, buf, 'image/webp');
    return { url, key, width, height, bytes: buf.length, backend: this.backend };
  }

  async uploadDataUri(uri: string, kind: string = 'misc'): Promise<string | null> {
    const raw = decodeDataUri(uri);
    if (!raw) return null;
    const info = await this.uploadImage(raw, kind);
    return info.url;
  }

  async normalizeImageField(value: string | null | undefined, kind: string): Promise<string> {
    if (value && value.startsWith('data:image')) {
      const url = await this.uploadDataUri(value, kind);
      return url || '';
    }
    return value || '';
  }

  async delete(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const key = this.keyFromUrl(url);
    if (!key) return;
    if (this.backend === 'r2' && this.client) {
      try {
        await this.client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
        return;
      } catch (e) {
        console.warn('R2 delete failed:', e);
      }
    }
    const abs = path.join(env.UPLOAD_DIR, key);
    try {
      await fs.unlink(abs);
    } catch { /* ignore */ }
  }

  async readLocalFile(relPath: string): Promise<Buffer | null> {
    const abs = path.join(env.UPLOAD_DIR, relPath);
    try {
      return await fs.readFile(abs);
    } catch {
      return null;
    }
  }
}

export const storage = new StorageService();
