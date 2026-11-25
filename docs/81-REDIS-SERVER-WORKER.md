# Redis, server y worker

**Corte:** 2026-11-25
**Estado:** PREPARADO SIN EJECUTAR. El servidor de staging autorizado ya tiene una
topología Compose con Redis, server y worker; aún no se ha desplegado.
**Motivo del bloqueo actual:** faltan acceso SSH, host key y token GHCR de solo
lectura. El entorno local sigue sin Redis.

## Configuración implementada

`apps/backend/src/lib/jovy/runtime-configuration.ts` resuelve perfiles
explícitos:

| Variable | Valores | Efecto |
|---|---|---|
| `WORKER_MODE` | `server`, `worker`, `shared` | `shared` por defecto |
| `MEDUSA_REDIS_ENABLED` | `true` | Activa Event Bus, Workflow Engine, Caching y Locking Redis |
| `MEDUSA_FF_CACHING` | `true` | Obligatorio al activar Redis |
| `EVENTS_REDIS_URL` | `redis://` o `rediss://` | Event Bus |
| `WORKFLOW_REDIS_URL` | `redis://` o `rediss://` | Workflow Engine |
| `CACHE_REDIS_URL` | `redis://` o `rediss://` | Provider de caching |
| `LOCKING_REDIS_URL` | `redis://` o `rediss://` | Locking distribuido |
| `SESSION_REDIS_URL` | `redis://` o `rediss://` | Sesiones de `express-session` |

`SESSION_REDIS_URL` es independiente de `MEDUSA_REDIS_ENABLED`. Se asigna a
`projectConfig.redisUrl` y `SESSION_REDIS_PREFIX` a `projectConfig.redisPrefix`.
No se confunde con Redis Caching.

## Preflight

`apps/backend/src/lib/jovy/runtime-preflight.ts` revisa el perfil antes de
arrancar y falla con mensajes que nombran variables, nunca valores. Reglas
principales:

- `staging` y `production` exigen `NODE_ENV=production`.
- PostgreSQL no puede ser loopback ni conservar placeholders.
- JWT y cookie deben ser distintos, reales y de al menos 32 caracteres.
- CORS debe ser exacto, HTTPS y sin wildcard en despliegue.
- `server` y `worker` separados exigen Redis compartido.
- Staging y producción exigen almacenamiento persistente S3-compatible.
- Sesiones en memoria solo generan advertencia si hay una única instancia.
- `DEPLOYMENT_ENV` es obligatorio para identificar el ambiente. Si se omite en
  producción, se infiere `production` y el preflight igualmente se ejecuta. Solo
  el build está exento.

## Topología de staging preparada

`deploy/staging/compose.yaml` separa:

- Redis con contraseña y bases `0` eventos, `1` workflows, `2` caché, `3` locking
  y `4` sesiones;
- `backend` con `WORKER_MODE=server`;
- `worker` con `WORKER_MODE=worker`;
- healthchecks de PostgreSQL, Redis, backend y storefront;
- smoke de Redis, worker y revalidación.

El runbook y los comandos están en `docs/89-DESPLIEGUE-STAGING-GHCR.md`.

## Worker

Medusa 2.22.6 ya separa responsabilidades:

- `shared`: API, Admin, subscribers y jobs en un proceso.
- `server`: API/Admin; no carga jobs ni procesa subscribers.
- `worker`: no carga rutas API ni Admin; procesa subscribers y jobs.

No se agregó un `admin.disable` propio: sería redundante y podría desviarse del
comportamiento oficial.

## Validación pendiente cuando exista Redis aislado

Checklist mínimo:

1. `WORKER_MODE=server` y `WORKER_MODE=worker` con URLs segregadas.
2. Event Bus: emitir y recibir un evento; comprobar reintento y duplicados.
3. Workflow Engine: ejecutar, fallar un step, compensar y reanudar.
4. Caching: escritura, lectura, TTL e invalidación por tag.
5. TTL distintos sobre el mismo tag en 2.22.6: comprobar que la invalidación
   elimina lo esperado; no asumir el comportamiento corregido en 2.23.0.
6. Locking: comparar PostgreSQL y Redis con dos procesos.
7. Reiniciar server sin perder trabajo; reiniciar worker y comprobar
   recuperación.
8. Verificar que no hay procesamiento duplicado.
9. Logs con identificador de proceso y modo.
10. Fallo de Redis: el proceso debe fallar de forma controlada, no silenciosa.

## Comandos preparados

Con un Redis autorizado y aislado:

```powershell
$env:DEPLOYMENT_ENV = "staging"
$env:NODE_ENV = "production"
$env:WORKER_MODE = "server"
$env:MEDUSA_REDIS_ENABLED = "true"
$env:MEDUSA_FF_CACHING = "true"
$env:EVENTS_REDIS_URL = "rediss://events.example:6379"
$env:WORKFLOW_REDIS_URL = "rediss://workflows.example:6379"
$env:CACHE_REDIS_URL = "rediss://cache.example:6379"
$env:LOCKING_REDIS_URL = "rediss://locking.example:6379"
$env:SESSION_REDIS_URL = "rediss://sessions.example:6379"
pnpm --dir apps/backend exec medusa start
```

En otra terminal, el worker usa el mismo perfil y `WORKER_MODE=worker`.

## Dictamen

**PREPARADO SIN EJECUTAR.** No se declara Redis validado. La configuración
existe, el preflight la revisa y los comandos están documentados, pero no hubo
un servicio real autorizado contra el cual probar conexión, eventos, workflows,
caché, locking ni reinicio.
