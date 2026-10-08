# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for Next.js 15 fullstack (Coolify deploy)
# ------------------------------------------------------------------
# PENTING soal variabel: hanya NEXT_PUBLIC_POS_URL dan NEXT_PUBLIC_WA_NUMBER yang
# perlu tersedia saat build (nilainya ikut ditanam oleh `next build`). Semua yang
# rahasia - DATABASE_URL, JWT_SECRET, OWNER_PASSWORD, R2_* - adalah variabel
# RUNTIME saja. Jangan aktifkan "Build Variable?" untuk variabel-variabel itu di
# Coolify: build arg tersimpan di history image dan tercetak polos di log
# deployment. Detailnya ada di DEPLOY.md.
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY web/package.json web/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

# --- builder ---
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
# backend/data is needed for seed CSVs/JSONs on first boot
COPY backend/data ./data
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Server build (Coolify) hanya punya RAM 4 GB. Batasi heap proses build utama
# supaya V8 melakukan GC lebih awal, bukan membengkak lalu mendorong server ke
# swap - swap thrashing itu yang membuat build sebelumnya makan 27 menit.
ENV NODE_OPTIONS=--max-old-space-size=2048
# Pakai Prisma CLI yang sudah terpasang & terpaku versinya, bukan `npx` (npx
# menembak registry npm dulu; di log deploy langkah ini sendiri makan ~20 detik).
RUN yarn prisma generate
# Simpan cache compiler Next.js di cache mount BuildKit supaya deploy berikutnya
# tidak mengompilasi semuanya dari nol. Isi cache tidak masuk ke image.
RUN --mount=type=cache,target=/app/.next/cache yarn build

# --- runner ---
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma runtime binaries
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Bring data folder (for seed on first boot) and prisma schema
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Upload dir for local fallback (mount a volume here on Coolify)
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data/uploads
VOLUME ["/data/uploads"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
