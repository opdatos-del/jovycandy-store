#!/usr/bin/env sh
set -eu

set -a
. ./.env.staging
set +a

BASE="https://${STAGING_HOST}"
CURL="curl -ksSf --connect-timeout 5 --max-time 20"

$CURL "$BASE/api/medusa/health" > /dev/null
$CURL "$BASE/api/medusa/health/ready" > /dev/null
$CURL "$BASE/" > /dev/null

# Confianza interna real: Node no debe depender del certificado autofirmado.
docker compose --env-file .env.staging exec -T storefront node -e \
  "fetch(process.env.MEDUSA_BACKEND_URL + '/store/products?limit=1', { headers: { 'x-publishable-api-key': process.env.MEDUSA_PUBLISHABLE_API_KEY } }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

docker compose --env-file .env.staging exec -T backend node -e \
  "fetch('http://storefront:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

docker compose --env-file .env.staging exec -T \
  -e REDISCLI_AUTH="$REDIS_PASSWORD" redis redis-cli ping | grep -q PONG

WORKER_ID=$(docker compose --env-file .env.staging ps -q worker)
test -n "$WORKER_ID"
test "$(docker inspect -f '{{.State.Running}}' "$WORKER_ID")" = "true"

TIMESTAMP=$(date +%s)
BODY='{"tags":["jovy-content"],"source":"staging-smoke"}'
SIGNATURE=$(printf '%s.%s' "$TIMESTAMP" "$BODY" \
  | openssl dgst -sha256 -hmac "$JOVY_REVALIDATION_SECRET" \
  | awk '{print $NF}')

$CURL -X POST "$BASE/api/revalidate" \
  -H 'content-type: application/json' \
  -H "x-jovy-timestamp: $TIMESTAMP" \
  -H "x-jovy-signature: $SIGNATURE" \
  --data "$BODY" > /dev/null

echo "[smoke] health, readiness, storefront, Store API, Redis, worker y revalidación OK"
