#!/bin/sh
set -e

mkdir -p /data/db /data/uploads

echo "==> prisma migrate deploy"
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "==> starting Next.js"
exec "$@"
