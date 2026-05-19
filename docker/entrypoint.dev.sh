#!/bin/sh
set -e

mkdir -p /data/db /data/uploads

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> seed (idempotent)"
node prisma/seed.mjs || echo "seed: skipped"

echo "==> starting Next.js dev"
exec "$@"
