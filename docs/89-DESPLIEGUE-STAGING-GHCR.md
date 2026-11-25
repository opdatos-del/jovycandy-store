# Despliegue de staging con GitHub Actions y GHCR

**Corte:** 2026-11-25
**Estado:** PREPARADO SIN EJECUTAR.
**Autorización:** servidor Linux de pruebas, no producción, proporcionado por el
responsable del proyecto. Docker y Compose disponibles; PostgreSQL y Redis en
contenedores aislados; runner alojado de GitHub con deploy SSH; S3 diferido.

## Arquitectura

```text
GitHub Actions (ubuntu-latest, workflow_dispatch)
  ├── build backend/storefront
  ├── push GHCR con tag SHA y staging
  └── environment staging con aprobación manual
          │ SSH con host key fijada
          ▼
Servidor Linux
  ├── Caddy :80/:443 (HTTPS con CA interna para IP)
  ├── PostgreSQL 16
  ├── Redis 7.4
  ├── Medusa server :9000 interno
  ├── Medusa worker sin HTTP
  └── Next.js :3000 interno
```

Rutas públicas:

| Ruta | Destino |
|---|---|
| `/api/medusa/*` | Medusa, con prefijo eliminado |
| `/api/revalidate` | Next.js |
| Resto | Next.js |
| Admin | `/api/medusa/app` |

Solo Caddy publica puertos. PostgreSQL, Redis, Medusa y Next.js permanecen en la
red interna de Compose.

## HTTPS con IP

No hay dominio. Caddy usa `tls internal` y genera un certificado autofirmado para
la IP. El navegador mostrará una advertencia que el operador debe aceptar en el
laboratorio. Esto permite probar cookies `Secure` y CORS HTTPS sin DNS.

No es equivalente a un certificado público confiable. Antes de un staging
compartido o producción se requiere un dominio y TLS válido.

## Archivos

| Archivo | Propósito |
|---|---|
| `apps/backend/Dockerfile` | Imagen multi-stage de Medusa |
| `apps/storefront/Dockerfile` | Imagen standalone de Next.js |
| `deploy/staging/compose.yaml` | Servicios, volúmenes, healthchecks y perfiles |
| `deploy/staging/Caddyfile` | Proxy HTTPS y rutas |
| `deploy/staging/generate-secrets.sh` | Crea `.env.staging` con secretos nuevos |
| `deploy/staging/deploy.sh` | Migra, bootstrap, despliega y verifica |
| `deploy/staging/smoke.sh` | Health, Redis, worker y revalidación |
| `deploy/staging/seed.sh` | Seed DEMO idempotente |
| `deploy/staging/backup.sh` | Backup de PostgreSQL y volúmenes |
| `deploy/staging/rollback.sh` | Vuelve a los digests anteriores |
| `.github/workflows/staging.yml` | Build/push GHCR y deploy SSH manual |

## CI

El CI automático mantiene solo las cinco suites básicas: build, tipos/lint/
unitarias, integración de módulos, integración HTTP y seguridad. No construye
ni levanta la topología staging en cada push.

El gate completo está en `.github/workflows/staging-image-smoke.yml`, manual:

- construye ambas imágenes;
- levanta PostgreSQL, Redis, server, worker, storefront y Caddy en el runner;
- ejecuta migraciones, bootstrap de key y smoke;
- repite el deploy para comprobar idempotencia y validación de la key;
- derriba volúmenes al terminar.

No se ejecutará hasta que el responsable lo autorice expresamente.

## Imágenes

- Backend: `ghcr.io/opdatos-del/jovycandy-store/backend@sha256:…`
- Storefront: `ghcr.io/opdatos-del/jovycandy-store/storefront@sha256:…`
- También se publican tags `<sha>` y `staging` para inspección, pero el deploy y
  el rollback usan digests inmutables.
- Arquitectura: `linux/amd64`.
- Imágenes privadas por defecto. El servidor debe autenticarse en GHCR con un
  token de solo lectura.

## Configuración de GitHub

Crear dos environments con aprobación manual y restricción a `main`:

- `staging-images`: autoriza construir/publicar; no debe contener secretos SSH.
- `staging`: autoriza el deploy y contiene las credenciales SSH.

Tanto la publicación de imágenes como el deploy rechazan otras ramas.

Secrets:

| Secret | Uso |
|---|---|
| `STAGING_SSH_HOST` | IP o hostname del servidor |
| `STAGING_SSH_USER` | usuario de deploy sin sudo amplio |
| `STAGING_SSH_KEY` | clave privada SSH dedicada |
| `STAGING_SSH_KNOWN_HOSTS` | host key fijada del servidor |

Variables:

| Variable | Ejemplo |
|---|---|
| `STAGING_SSH_PORT` | `22` |
| `STAGING_DEPLOY_PATH` | `/opt/jovycandy-staging` |
| `STAGING_PUBLIC_URL` | `https://<IP-publica>` |

`STAGING_PUBLIC_URL` debe ser variable del environment `staging-images` o del
repositorio. El workflow exige CI `success` para el mismo commit antes de
publicar imágenes.

`GITHUB_TOKEN` publica en GHCR con `packages: write`. No se necesita un PAT en
el workflow.

## Preparación única del servidor

Requisitos:

- Linux x86_64;
- Docker Engine y Docker Compose v2;
- `openssl`, `curl`, `gzip`, `tar`;
- puertos 80 y 443 libres;
- usuario de deploy con acceso a Docker;
- clave SSH dedicada y host key conocida.

```bash
sudo useradd --create-home --shell /bin/bash jovy-deploy
sudo usermod -aG docker jovy-deploy
sudo install -d -o jovy-deploy -g jovy-deploy /opt/jovycandy-staging
```

Autenticar GHCR una vez en el servidor:

```bash
printf '%s' '<token-read-only>' \
  | docker login ghcr.io -u '<usuario-github>' --password-stdin
```

No guardar el token en el repositorio ni en el historial de shell.

Copiar `deploy/staging/` al servidor y generar secretos:

```bash
cd /opt/jovycandy-staging
./generate-secrets.sh <IP-publica>
chmod 700 *.sh
```

El script crea `.env.staging` con permisos `0600`, PostgreSQL, Redis, JWT,
cookies, MFA, comercio y revalidación. No reutiliza secretos de otros ambientes.

## Flujo de deploy

1. Confirmar CI verde en el commit elegido.
2. Ejecutar manualmente **Staging deploy** desde GitHub.
3. Aprobar el environment `staging`.
4. Actions construye y publica ambas imágenes.
5. SSH copia los artefactos sin sobrescribir `.env.staging`.
6. `deploy.sh`:
   - descarga imágenes por digest;
   - inicia PostgreSQL y Redis;
   - crea un backup previo a migraciones;
   - ejecuta `db:migrate` y `db:migrate:search`;
   - crea o rota la publishable key inicial de staging;
   - actualiza server, worker, storefront y Caddy;
   - espera healthchecks y ejecuta smoke;
   - guarda los digests anteriores para rollback.

El deploy no es automático en cada push. Se mantiene manual hasta validar la
infraestructura y los procedimientos.

## Primer seed

Después del primer deploy saludable:

```bash
cd /opt/jovycandy-staging
./seed.sh
```

El seed crea el catálogo y el comercio DEMO de forma idempotente. No usar datos
de proyectos históricos ni producción.

La publishable key se crea en el bootstrap y se guarda en el volumen
`staging-data`, ruta `/app/data/staging-publishable-key.txt`, con permisos
`0600`. `deploy.sh` la lee con el servicio `print-key` y la inyecta en
`.env.staging`. La migración inicial de Medusa crea una key por defecto sin token
recuperable; el bootstrap la rota solo con
`STAGING_ROTATE_DEFAULT_PUBLISHABLE_KEY=true`. Si el volumen se pierde pero
`.env.staging` conserva un token válido, el script lo valida y restaura el
archivo. Si no hay token válido y la key existente no es la inicial, el script
falla sin rotar keys ajenas.

## Administrador inicial

El primer deploy no crea un usuario Admin. Después del smoke, crear uno con una
contraseña temporal fuera del historial de shell:

```bash
cd /opt/jovycandy-staging
read -r -s -p "Password temporal: " ADMIN_PASSWORD; echo
docker compose --env-file .env.staging run --rm \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" backend \
  sh -lc 'pnpm exec medusa user --email admin@example.test --password "$ADMIN_PASSWORD"'
unset ADMIN_PASSWORD
```

Después asignar el rol Superadministrador con el script compilado y el correo
como selector:

```bash
docker compose --env-file .env.staging run --rm backend \
  sh -lc 'pnpm exec medusa exec ./src/scripts/bootstrap-authz.js -- --email=admin@example.test'
```

No guardar la contraseña en el repositorio ni en logs.

## Validación de Redis y worker

El smoke comprueba:

- `/health` y `/health/ready`;
- storefront;
- Redis `PONG`;
- contenedor worker en ejecución;
- revalidación CMS firmada.

Checklist adicional manual:

1. Emitir un evento y observar subscriber en logs del worker.
2. Fallar un step de workflow y comprobar compensación.
3. Escribir/leer/invalidar una entrada de caché.
4. Probar TTL distintos sobre el mismo tag en 2.22.6.
5. Reiniciar server y comprobar que no se pierde trabajo.
6. Reiniciar worker y comprobar recuperación.
7. Confirmar que no hay procesamiento duplicado.

Hasta completar esta lista, Redis y worker separado siguen en
`PREPARADO SIN EJECUTAR`.

## Storage

S3 queda diferido. Staging usa `file-local` con:

```dotenv
STAGING_ALLOW_LOCAL_STORAGE=true
FILE_STORAGE_PROVIDER=local
```

El preflight solo permite esta excepción con `DEPLOYMENT_ENV=staging`; en
producción falla. El directorio `static` usa el volumen `media-data` y debe
incluirse en backup. No se declara storage remoto validado.

## Backup y recuperación

```bash
./backup.sh
```

Genera:

- `postgres.sql.gz`;
- `media.tgz`;
- `redis.tgz`;
- `staging-data.tgz` (contiene la publishable key; tratar como secreto).

No se declara backup validado sin una restauración real. La restauración debe
ensayarse en volúmenes y bases aislados antes de compartir staging.

## Rollback

```bash
./rollback.sh
```

Usa los digests de `.image-backend.previous` y `.image-storefront.previous`. Si
el smoke falla durante un deploy, `deploy.sh` intenta volver automáticamente a
esas imágenes. Un fallo del primer deploy no tiene imágenes anteriores y deja
los contenedores disponibles para diagnóstico.

El rollback de código **no** revierte migraciones de PostgreSQL ni Search. El
backup previo permite restauración manual, pero esta debe ensayarse y aprobarse.
Las migraciones deben ser expand/contract compatibles hacia atrás hasta que
exista un procedimiento automático de recuperación.

## Seguridad

- Storefront usa `http://backend:9000` y Medusa usa
  `http://storefront:3000/api/revalidate` dentro de Compose. El navegador sigue
  entrando por HTTPS; no se depende de que Node confíe en la CA interna de
  Caddy.
- Secrets fuera de Git y con permisos restringidos.
- Clave SSH dedicada y host key fijada.
- Environment `staging` con aprobación manual.
- Contenedores de aplicación como usuario `node`.
- Solo Caddy expuesto.
- CORS HTTPS exacto.
- Cookies `Secure`.
- Redis con contraseña y bases segregadas.
- Imágenes con SBOM y procedencia.
- Acciones de GitHub fijadas por commit SHA.
- Sin pagos, logística, fiscalidad ni datos reales.

## Riesgos conocidos

1. Certificado HTTPS autofirmado para IP.
2. Un solo servidor: no prueba alta disponibilidad real.
3. Worker sin healthcheck HTTP; smoke solo verifica que el proceso corre.
4. `file-local` no es el destino productivo.
5. Backup aún sin restauración ensayada.
6. GHCR privado requiere token de solo lectura en el servidor.

## Validación local

| Control | Resultado |
|---|---|
| Unitarias backend | 444/444 PASS |
| Integración de módulos | 47/47 PASS |
| Integración HTTP | 102/102 PASS |
| Bootstrap de publishable key | Rotación, segundo deploy y restauración de volumen PASS |
| Typecheck backend/storefront | PASS |
| Build backend/storefront | PASS |
| Hadolint | PASS |
| Actionlint | PASS |
| YAML y `sh -n` | PASS |
| Paquete backend compilado con aliases `@jovy/*` | PASS |
| Servidor standalone de Next.js | PASS |
| Gitleaks en archivos nuevos | 0 hallazgos |
| Boot Compose completo | NO EJECUTADO local; workflow manual preparado |

## Pendientes antes del primer deploy

1. Crear `staging-images` y `staging` con revisores y restricción a `main`.
2. Proteger `main` y exigir CI.
3. Confirmar IP, usuario SSH, host key y ruta de despliegue.
4. Instalar token GHCR de solo lectura en el servidor.
5. Confirmar que el servidor es dedicado y descartable: el usuario Docker tiene
   privilegios equivalentes a root.
6. Ejecutar el workflow manual y validar Redis, worker, caché y recuperación.

## Dictamen

**CÓDIGO DE DESPLIEGUE APROBADO POR REVISIÓN.** El servidor sigue intacto, no
se publicaron imágenes y no se ejecutó Docker. El primer deploy permanece
**BLOQUEADO** hasta crear los environments, proteger la rama y recibir acceso
SSH/GHCR autorizado.
