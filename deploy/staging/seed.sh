#!/usr/bin/env sh
set -eu

docker compose --env-file .env.staging --profile seed run --rm seed
echo "[seed] catálogo y comercio de laboratorio sembrados de forma idempotente"
