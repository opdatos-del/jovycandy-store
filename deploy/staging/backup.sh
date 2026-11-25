#!/usr/bin/env bash
set -euo pipefail
umask 077

set -a
. ./.env.staging
set +a

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DIR=backups/$STAMP
mkdir -p "$DIR"
chmod 700 "$DIR"

docker compose --env-file .env.staging exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$DIR/postgres.sql.gz"
gzip -t "$DIR/postgres.sql.gz"

docker run --rm \
  -v jovycandy-staging_media:/data \
  -v "$PWD/$DIR:/backup" \
  alpine:3.21 tar -czf /backup/media.tgz -C /data .

docker run --rm \
  -v jovycandy-staging_redis-data:/data \
  -v "$PWD/$DIR:/backup" \
  alpine:3.21 tar -czf /backup/redis.tgz -C /data .

docker run --rm \
  -v jovycandy-staging_staging-data:/data \
  -v "$PWD/$DIR:/backup" \
  alpine:3.21 tar -czf /backup/staging-data.tgz -C /data .

echo "[backup] $DIR"
echo "No se declara backup validado hasta restaurarlo en una base/volumen aislado."
