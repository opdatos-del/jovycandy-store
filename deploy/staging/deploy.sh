#!/usr/bin/env sh
set -eu

TAG=${1:?Uso: ./deploy.sh <image-tag> <backend-image> <storefront-image>}
BACKEND_IMAGE_ARG=${2:?Falta backend-image}
STOREFRONT_IMAGE_ARG=${3:?Falta storefront-image}
CI_LOCAL_IMAGES=false
if [ "${GITHUB_ACTIONS:-false}" = "true" ]; then
  case "${GITHUB_WORKFLOW:-}" in
    CI|"Staging image smoke") CI_LOCAL_IMAGES=true ;;
  esac
fi

if [ "$CI_LOCAL_IMAGES" != "true" ]; then
  BACKEND_DIGEST=${BACKEND_IMAGE_ARG#*@sha256:}
  STOREFRONT_DIGEST=${STOREFRONT_IMAGE_ARG#*@sha256:}
  case "$BACKEND_IMAGE_ARG" in
    *@sha256:*) ;;
    *) echo "BACKEND_IMAGE debe ser un digest sha256" >&2; exit 1 ;;
  esac
  case "$STOREFRONT_IMAGE_ARG" in
    *@sha256:*) ;;
    *) echo "STOREFRONT_IMAGE debe ser un digest sha256" >&2; exit 1 ;;
  esac
  printf '%s' "$BACKEND_DIGEST" | grep -Eq '^[0-9a-f]{64}$' || {
    echo "BACKEND_IMAGE no tiene un digest sha256 válido" >&2; exit 1;
  }
  printf '%s' "$STOREFRONT_DIGEST" | grep -Eq '^[0-9a-f]{64}$' || {
    echo "STOREFRONT_IMAGE no tiene un digest sha256 válido" >&2; exit 1;
  }
elif [ "${ALLOW_LOCAL_IMAGES:-false}" != "true" ]; then
  echo "ALLOW_LOCAL_IMAGES=true es obligatorio en el gate de CI" >&2
  exit 1
fi

test -f .env.staging

set -a
. ./.env.staging
set +a
export IMAGE_TAG="$TAG"
export BACKEND_IMAGE="$BACKEND_IMAGE_ARG"
export STOREFRONT_IMAGE="$STOREFRONT_IMAGE_ARG"

if [ -f .image-tag ]; then
  cp .image-tag .image-tag.previous
fi
if [ -f .image-backend ]; then
  cp .image-backend .image-backend.previous
fi
if [ -f .image-storefront ]; then
  cp .image-storefront .image-storefront.previous
fi

compose() {
  docker compose --env-file .env.staging "$@"
}

if [ "${SKIP_PULL:-false}" != "true" ]; then
  echo "[deploy] descargando imágenes por digest"
  compose pull
fi

echo "[deploy] iniciando PostgreSQL y Redis"
compose up -d --wait --wait-timeout 120 postgres redis

echo "[deploy] backup previo a migraciones"
bash ./backup.sh

echo "[deploy] aplicando migraciones"
compose run --rm migrate

echo "[deploy] asegurando publishable API key"
compose run --rm bootstrap-key

KEY=$(compose run --rm print-key)
sed -i "s|^MEDUSA_PUBLISHABLE_API_KEY=.*|MEDUSA_PUBLISHABLE_API_KEY=$KEY|" .env.staging
export MEDUSA_PUBLISHABLE_API_KEY="$KEY"

echo "[deploy] actualizando aplicación"
compose up -d --wait --wait-timeout 180 --remove-orphans --force-recreate \
  caddy backend worker storefront

if ! sh ./smoke.sh; then
  echo "[deploy] smoke falló" >&2
  if [ -f .image-backend.previous ] && [ -f .image-storefront.previous ]; then
    export BACKEND_IMAGE=$(cat .image-backend.previous)
    export STOREFRONT_IMAGE=$(cat .image-storefront.previous)
    echo "[deploy] restaurando imágenes anteriores" >&2
    compose up -d --wait --wait-timeout 180 --remove-orphans --force-recreate \
      caddy backend worker storefront
  fi
  exit 1
fi

printf '%s\n' "$TAG" > .image-tag
printf '%s\n' "$BACKEND_IMAGE" > .image-backend
printf '%s\n' "$STOREFRONT_IMAGE" > .image-storefront
sed -i \
  -e "s|^IMAGE_TAG=.*|IMAGE_TAG=$TAG|" \
  -e "s|^BACKEND_IMAGE=.*|BACKEND_IMAGE=$BACKEND_IMAGE|" \
  -e "s|^STOREFRONT_IMAGE=.*|STOREFRONT_IMAGE=$STOREFRONT_IMAGE|" \
  .env.staging
echo "[deploy] staging saludable con $TAG"
