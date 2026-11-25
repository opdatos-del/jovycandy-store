#!/usr/bin/env sh
set -eu

HOST=${1:?Uso: ./generate-secrets.sh <IP-publica-del-servidor>}
FILE=.env.staging

if [ -f "$FILE" ]; then
  echo "Ya existe $FILE; no se sobrescribe." >&2
  exit 1
fi

umask 077
cat > "$FILE" <<EOF
# Generado para staging. No versionar.
STAGING_HOST=$HOST
GHCR_NAMESPACE=opdatos-del/jovycandy-store
IMAGE_TAG=replace-with-sha
BACKEND_IMAGE=
STOREFRONT_IMAGE=
IMAGE_PULL_POLICY=always

POSTGRES_USER=jovy
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=jovycandy_staging
REDIS_PASSWORD=$(openssl rand -hex 24)

JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
AUTH_MFA_ENCRYPTION_KEY=$(openssl rand -hex 32)
JOVY_COMMERCE_SECRET=$(openssl rand -hex 32)
JOVY_REVALIDATION_SECRET=$(openssl rand -hex 32)

# Se completa en el primer deploy.
MEDUSA_PUBLISHABLE_API_KEY=
EOF

chmod 600 "$FILE"
echo "Creado $FILE con secretos nuevos. Guárdalo en el gestor de secretos del servidor."
