# Staging y CI/CD

**Corte:** 2026-11-25
**Estado:** PREPARADO PARA REVISIÓN. Sin despliegue.
**Implementación:** `deploy/staging/`, Dockerfiles y `.github/workflows/staging.yml`.
**Runbook:** `docs/89-DESPLIEGUE-STAGING-GHCR.md`.
**Regla vigente:** el servidor de staging está autorizado para pruebas; no se
ejecutó Docker ni se publicó una imagen todavía.

## CI actual

`.github/workflows/ci.yml` conserva los cinco jobs originales. El boot completo
de contenedores **no** se ejecuta en CI automático; queda en el workflow manual
`.github/workflows/staging-image-smoke.yml`, que solo se dispara cuando se
autorice expresamente.

| Job | Contenido | Resultado de referencia |
|---|---|---|
| Tipos Medusa y build | `medusa build`, artefactos de tipos, build storefront | PASS |
| Tipos, lint y unitarias | typecheck backend/storefront, lint, unitarias | PASS |
| Integración de módulos | PostgreSQL 16 de servicio | PASS |
| Integración HTTP | PostgreSQL 16 de servicio | PASS |
| Secretos y dependencias | Gitleaks + `pnpm audit --prod` | Ver nota |
| Imágenes staging y smoke | Workflow manual `staging-image-smoke.yml` | NO EJECUTADO hasta autorización |

Nota Gitleaks: el run 45450870051 falló por un falso positivo
`generic-api-key` sobre la variable de secreto S3 de la plantilla
`apps/backend/.env.example`. El valor no era una credencial. La plantilla se
corrigió a variable vacía con explicación de gestor de secretos. El escaneo
local del árbol corregido no encontró fugas. No se desactivó Gitleaks ni se
agregó una exclusión global. El CI debe volver a ejecutarse después del commit;
no se declara verde hasta verlo.

Las pruebas nuevas se integran automáticamente:

- unitarias de Search MXN, preflight y revalidación;
- integración HTTP de promociones, inventario, pedido y readiness;
- el resto de la matriz existente.

## Topología objetivo de staging

```text
Internet
  │ HTTPS
  ▼
Proxy / TLS
  ├── Next.js storefront
  ├── Medusa server (API + Admin)
  └── Medusa worker (subscribers + jobs)
        │
        ├── PostgreSQL aislado
        ├── Redis aislado (opt-in)
        └── Bucket S3-compatible (opt-in)
```

Requisitos mínimos:

- PostgreSQL con backup y restauración ensayada;
- Redis segregado por responsabilidad si se activa;
- bucket con CORS, retención y credenciales temporales;
- secretos por ambiente fuera de Git;
- CORS HTTPS exactos;
- cookies `Secure`;
- `DEPLOYMENT_ENV=staging`, `NODE_ENV=production`;
- worker separado solo después de validar Redis y reintentos;
- observabilidad y health checks.

## Variables por ambiente

| Variable | Desarrollo | Staging |
|---|---|---|
| `DEPLOYMENT_ENV` | `development` | `staging` |
| `NODE_ENV` | `development` | `production` |
| `WORKER_MODE` | `shared` | `server` + `worker` |
| `FILE_STORAGE_PROVIDER` | `local` | `local` con excepción explícita; S3 diferido |
| `MEDUSA_REDIS_ENABLED` | no | según topología |
| `SESSION_REDIS_URL` | opcional | recomendado |
| `STOREFRONT_REVALIDATION_*` | opcional | obligatorio si se usa CMS |
| `JOVY_REVALIDATION_SECRET` | opcional | obligatorio si se usa CMS |

## Migraciones

```powershell
pnpm --dir apps/backend exec medusa db:migrate
pnpm --dir apps/backend exec medusa db:migrate:search
```

Reglas:

- migraciones append-only; no editar una aplicada;
- ejecutar primero en base descartable;
- backup antes de staging;
- verificar Search: versión nueva, activación e idempotencia;
- no usar eliminación automática de índices sin revisión;
- no ejecutar seeds de laboratorio sobre datos comerciales reales.

## Recuperación

Preparado, no validado:

- backup lógico de PostgreSQL;
- backup de medios;
- restauración en base aislada;
- rollback de código al commit anterior;
- recuperación de worker;
- reconstrucción de índices Search;
- revocación de secretos.

No se declara backup validado sin una restauración real. No se ejecutó ninguna
restauración porque no hay staging autorizado.

## GitHub

Configuración recomendada, no aplicada:

- proteger `main` con Pull Request obligatorio;
- exigir los cinco checks actuales;
- impedir force-push y borrado;
- requerir revisión y conversación resuelta;
- usar environments para staging/producción;
- secretos por environment, nunca en el repositorio;
- concurrencia para cancelar ejecuciones obsoletas;
- aprobación manual para despliegues;
- documentar rollback.

El estado conocido es `main` sin protección. Cambiar reglas administrativas
requiere autorización y no se hizo en esta campaña.

## Pipeline de despliegue

Se creó un workflow manual `Staging deploy` con:

- build multi-stage de backend y storefront;
- publicación en GHCR por digest, con tags SHA y `staging` para inspección;
- SBOM y procedencia;
- environment `staging-images` con aprobación antes de publicar;
- environment `staging` con aprobación antes del deploy SSH;
- exigencia de CI `success` para el mismo commit;
- deploy por SSH con host key fijada;
- migraciones, bootstrap de publishable key y smoke automático;
- rollback al tag anterior si el smoke falla.

No se ejecuta en cada push y no se ha disparado. Antes del primer deploy se
necesitan IP, usuario SSH, host key, ruta de deploy y token GHCR de solo lectura
en el servidor. El procedimiento completo está en
`docs/89-DESPLIEGUE-STAGING-GHCR.md`.

## Dictamen

**NO-GO PARA STAGING DESPLEGADO.** La configuración y los artefactos están
preparados, pero faltan infraestructura aislada, secretos, TLS, backup,
restauración y aprobación. **NO-GO PARA PRODUCCIÓN.**
