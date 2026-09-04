"""Apply the Cloudflare R2 bucket CORS policy (S3 API).

WHY THIS IS NEEDED
------------------
Receipt / voucher share images are rendered to a canvas with html2canvas
(`useCORS: true`) and the shop logo is an <img crossOrigin="anonymous">.
Before the R2 migration the logo was an inline base64 data URI, so CORS never
applied. Now the logo is served from https://cdn.daneswara.com, and a
cross-origin image with crossOrigin="anonymous" is BLOCKED FROM RENDERING
unless the response carries Access-Control-Allow-Origin. Without this policy
the logo silently disappears from receipts and share cards.

Usage:
    cd /app/backend && python scripts/r2_cors.py         # apply + verify
    cd /app/backend && python scripts/r2_cors.py --show  # only print current policy
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# The web app owns the canonical .env in this deployment.
for candidate in (Path("/app/web/.env"), Path(__file__).resolve().parent.parent / ".env"):
    if candidate.exists():
        load_dotenv(candidate, override=False)

ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
ACCESS_KEY = os.environ.get("R2_ACCESS_KEY_ID", "")
SECRET_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
BUCKET = os.environ.get("R2_BUCKET", "")
ENDPOINT = os.environ.get("R2_ENDPOINT") or f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"

# Origins allowed to read objects into a <canvas>. Keep this list tight.
ALLOWED_ORIGINS = [
    "https://daneswara.com",
    "https://www.daneswara.com",
    "https://pos.daneswara.com",
    "https://app.daneswara.com",
    "https://dashboard.daneswara.com",
    "https://daneswaraprint.com",
    "https://www.daneswaraprint.com",
    "http://localhost:3000",
]

extra = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
if extra and extra not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append(extra)

CORS_CONFIG = {
    "CORSRules": [
        {
            "AllowedOrigins": ALLOWED_ORIGINS,
            "AllowedMethods": ["GET", "HEAD"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
            "MaxAgeSeconds": 86400,
        }
    ]
}


def client():
    missing = [n for n, v in
               (("R2_ACCOUNT_ID", ACCOUNT_ID), ("R2_ACCESS_KEY_ID", ACCESS_KEY),
                ("R2_SECRET_ACCESS_KEY", SECRET_KEY), ("R2_BUCKET", BUCKET)) if not v]
    if missing:
        raise SystemExit(f"Missing environment variables: {', '.join(missing)}")
    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
    )


def show(s3) -> None:
    try:
        current = s3.get_bucket_cors(Bucket=BUCKET)
        print("Current CORS rules:")
        for rule in current.get("CORSRules", []):
            print("  origins:", rule.get("AllowedOrigins"))
            print("  methods:", rule.get("AllowedMethods"))
            print("  max-age:", rule.get("MaxAgeSeconds"))
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code")
        if code in ("NoSuchCORSConfiguration", "NoSuchCORSConfig", "404"):
            print("No CORS configuration set on this bucket.")
        else:
            raise


def main() -> int:
    s3 = client()
    if "--show" in sys.argv:
        show(s3)
        return 0

    print(f"Bucket: {BUCKET}  endpoint: {ENDPOINT}")
    print("Before ->")
    show(s3)

    s3.put_bucket_cors(Bucket=BUCKET, CORSConfiguration=CORS_CONFIG)
    print("\nCORS policy applied.")
    print("After ->")
    show(s3)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
