#!/usr/bin/env python3
"""
Cloudflare R2 helper: verify bucket access, apply CORS (needed for receipt-logo canvas rendering & fonts),
and optionally sync the landing static assets (frontend/public/assets) as WebP into the bucket.

    python scripts/r2_setup.py --check
    python scripts/r2_setup.py --cors
    python scripts/r2_setup.py --sync-assets ../frontend/public/assets

Reads R2_* from backend/.env (or environment).
"""
import argparse
import mimetypes
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import boto3  # noqa: E402
from botocore.config import Config  # noqa: E402

from app.config import settings  # noqa: E402


def client():
    return boto3.client(
        "s3", endpoint_url=settings.r2_endpoint, aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY, region_name="auto", config=Config(signature_version="s3v4"),
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--cors", action="store_true")
    ap.add_argument("--sync-assets", metavar="DIR")
    ap.add_argument("--prefix", default=f"{settings.R2_PREFIX}/static")
    args = ap.parse_args()
    if not settings.R2_BUCKET:
        print("R2_BUCKET is empty in backend/.env - set the bucket name first.")
        sys.exit(1)
    s3 = client()
    if args.check or not (args.cors or args.sync_assets):
        s3.head_bucket(Bucket=settings.R2_BUCKET)
        key = f"{settings.R2_PREFIX}/healthcheck.txt"
        s3.put_object(Bucket=settings.R2_BUCKET, Key=key, Body=b"ok", ContentType="text/plain")
        print(f"OK: bucket '{settings.R2_BUCKET}' reachable, test object -> {settings.R2_PUBLIC_BASE_URL}/{key}")
    if args.cors:
        s3.put_bucket_cors(Bucket=settings.R2_BUCKET, CORSConfiguration={"CORSRules": [{
            "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 86400,
        }]})
        print("OK: CORS rules applied (GET/HEAD from any origin)")
    if args.sync_assets:
        root = Path(args.sync_assets)
        n = 0
        for f in root.rglob("*"):
            if not f.is_file():
                continue
            key = f"{args.prefix}/{f.relative_to(root).as_posix()}"
            ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
            if f.suffix == ".webp":
                ctype = "image/webp"
            s3.put_object(Bucket=settings.R2_BUCKET, Key=key, Body=f.read_bytes(), ContentType=ctype, CacheControl="public, max-age=2592000")
            n += 1
            print("  uploaded", key)
        print(f"OK: {n} files synced. Set REACT_APP_ASSET_BASE={settings.R2_PUBLIC_BASE_URL}/{args.prefix} to serve them from R2.")


if __name__ == "__main__":
    main()
