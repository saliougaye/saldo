#!/bin/sh
# Creates the attachment bucket the dev server writes to (§10). Runs on every start; creating a
# bucket that already exists is not an error worth stopping for.
set -eu

BUCKET="${SALDO_BUCKET:-saldo-attachments}"

aws --endpoint-url=http://localhost:4566 s3api create-bucket \
  --bucket "$BUCKET" \
  --region us-east-1 >/dev/null 2>&1 || true

echo "floci: bucket $BUCKET ready"
