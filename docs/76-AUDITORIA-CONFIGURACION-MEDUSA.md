# Auditoría de configuración Medusa

**Corte:** 2026-11-24
**Estado:** EN IMPLEMENTACIÓN. Preparación local; ningún proveedor externo fue activado.

## Objetivo y alcance

Establecer línea base verificable para llevar JovyCandy a staging sin sustituir
los módulos comerciales nativos de Medusa ni alterar datos comerciales.

La autoridad de producto, precio, inventario, pedidos, clientes, pagos,
fulfillment, promociones, archivos y autenticación continúa en Medusa. Los
módulos `jovy-*` conservan contenido, marketing, editorial visual, familias y
autorización administrativa.

## Evidencia consultada

| Fuente | Evidencia | Resultado |
|---|---|---|
| Git | `main` y `origin/main` en `1ba0b8188d1f04df0b6aaa5d2f29221eb6eac0e3` antes de esta campaña | Sin divergencia inicial |
| CI | GitHub Actions [run 45437735774](https://github.com/opdatos-del/jovycandy-store/actions/runs/45437735774) | 5/5 jobs PASS |
| Runtime Medusa | `medusa exec` con Query Graph, lectura solamente | Redis ausente, fake Redis y Local Event Bus |
| Configuración | `apps/backend/medusa-config.ts` | `file-local`, locking PostgreSQL, módulos Jovy |
| Semillas y pruebas | scripts, tests y documentación del repositorio | Laboratorio comercial reproducible |

## Inventario observado

| Área | Resultado | Estado |
|---|---|---|
| Store | 1 store; nombre actual `Default Store` | CONFIGURADO; identidad comercial pendiente |
| Regiones | 2: Europa histórica y México/MXN de laboratorio | FUNCIONAL EN LABORATORIO |
| Canales | 1 canal de venta por defecto | FUNCIONAL; B2B no definido |
| Productos | 31 productos; catálogo Jovy con variantes nativas | FUNCIONAL |
| Inventario | 20 inventory items; variantes Jovy con `manage_inventory=false` y `allow_backorder=true` | INCOMPLETO PARA PRODUCCIÓN |
| Ubicaciones | Una ubicación europea histórica; fulfillment set de México laboratorio | PREPARADO EN LABORATORIO |
| Envío | 4 opciones manuales, incluyendo estándar/express DEMO México | FUNCIONAL EN LABORATORIO |
| Impuestos | Tax region de México; sin política contable autorizada | BLOQUEADO POR DECISIÓN FISCAL |
| Pago | `pp_system_default` | FUNCIONAL EN LABORATORIO; no cobra |
| Pedidos/clientes | 24 pedidos y 26 clientes de laboratorio | FUNCIONAL EN LABORATORIO |
| Promociones | 0 promociones | PENDIENTE |
| API keys | 2 publishable API keys | CONFIGURADO; revisar asignación por canal antes de staging |
| Search | Índice PostgreSQL disponible | INCOMPLETO: campos de precio solo `eur`/`usd`, no `mxn` |

Los datos históricos no se eliminan durante esta campaña. Su depuración exige
decisión operativa y respaldo validado.

## Arquitectura runtime preparada

`apps/backend/src/lib/jovy/runtime-configuration.ts` centraliza la selección
explícita de perfiles. `medusa-config.ts` registra solamente proveedores del
perfil activo:

```text
Development predeterminado
  PostgreSQL locking + file-local + worker shared

Staging/producción autorizado
  Medusa server/worker + PostgreSQL + Redis opcional + S3-compatible opcional
```

| Variable | Valores | Comportamiento |
|---|---|---|
| `WORKER_MODE` | `server`, `worker`, `shared` | `shared` por defecto; permite procesos separados sin otro repositorio |
| `MEDUSA_REDIS_ENABLED` | `true` | Activa Event Bus, Workflow Engine, Caching y locking Redis; exige todas las URLs y `MEDUSA_FF_CACHING=true` |
| `EVENTS_REDIS_URL` | URL Redis | Bus de eventos |
| `WORKFLOW_REDIS_URL` | URL Redis | Persistencia de workflows |
| `CACHE_REDIS_URL` | URL Redis | Provider de caching |
| `LOCKING_REDIS_URL` | URL Redis | Locking distribuido |
| `FILE_STORAGE_PROVIDER` | `local`, `s3` | Conserva `local` por defecto; `s3` exige configuración completa |
| `S3_*` | credenciales y bucket aislados | Provider `file-s3`; no se activa sin credenciales |

La configuración rechaza `ADMIN_ALLOW_HTTP=true` bajo `NODE_ENV=production`.
Las cookies de sesión son `Secure` en producción. No existe bypass para HTTP
productivo.

## Procedimiento por entorno

1. Partir de `apps/backend/.env.example`; nunca versionar `.env`.
2. Development: conservar `WORKER_MODE=shared`, `FILE_STORAGE_PROVIDER=local`
   y Redis desactivado.
3. Staging: crear PostgreSQL, Redis y bucket aislados; cargar secretos mediante
   gestor de secretos; configurar CORS HTTPS exactos; ejecutar migraciones y
   seeds DEMO solo en la base aislada.
4. Iniciar API con `WORKER_MODE=server` y worker con `WORKER_MODE=worker` solo
   después de comprobar Redis, health checks, retención de jobs y reintentos.
5. Probar subida/lectura de archivos, eventos, workflows, caché e invalidación
   antes de usar el perfil en producción.

## Seguridad y rollback

- Ninguna URL Redis/S3, secreto, endpoint real o cuenta externa está guardada
  en Git. Las plantillas contienen placeholders no funcionales.
- Redis y S3 son opt-in: quitar sus variables restaura proveedores locales al
  siguiente despliegue compatible. No migrar medios ni borrar `static/` sin
  inventario, backup y prueba de restauración.
- No se puede declarar seguridad de cookies, proxy, CSRF, backup o recuperación
  sin un staging HTTPS autorizado.

## Pruebas y límites actuales

- Especificación unitaria: perfil local, rechazo HTTP productivo, Redis
  incompleto, caching feature flag, worker separado y S3 incompleto.
- Validación histórica de estabilización: build/typecheck backend, 394 unitarias,
  47 integración de módulos, 93 HTTP, Admin E2E 2/2, Storefront E2E 25/25 y
  seed aislado idempotente.
- Pendiente: Redis real, S3 real, worker reiniciable, HTTPS, caching/invalidation,
  recuperación, pagos, correo, logística, fiscalidad y búsqueda MXN.

## Dictamen

**GO PARA CONFIGURAR STAGING:** condicionado a infraestructura aislada,
secretos, HTTPS y decisiones bloqueantes.
**NO-GO PARA PRODUCCIÓN:** faltan proveedores autorizados, inventario confiable,
política fiscal/logística, ensayo de recuperación y validación preproductiva.
