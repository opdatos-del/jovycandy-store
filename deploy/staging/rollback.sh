#!/usr/bin/env sh
set -eu

test -f .image-backend.previous
test -f .image-storefront.previous

set -a
. ./.env.staging
set +a
export BACKEND_IMAGE=$(cat .image-backend.previous)
export STOREFRONT_IMAGE=$(cat .image-storefront.previous)

docker compose --env-file .env.staging up -d --wait --wait-timeout 180 \
  --remove-orphans --force-recreate caddy backend worker storefront
sh ./smoke.sh

if [ -f .image-tag.previous ]; then
  cp .image-tag.previous .image-tag
fi
cp .image-backend.previous .image-backend
cp .image-storefront.previous .image-storefront
sed -i \
  -e "s|^BACKEND_IMAGE=.*|BACKEND_IMAGE=$BACKEND_IMAGE|" \
  -e "s|^STOREFRONT_IMAGE=.*|STOREFRONT_IMAGE=$STOREFRONT_IMAGE|" \
  .env.staging
echo "[rollback] staging restaurado a $BACKEND_IMAGE y $STOREFRONT_IMAGE"
