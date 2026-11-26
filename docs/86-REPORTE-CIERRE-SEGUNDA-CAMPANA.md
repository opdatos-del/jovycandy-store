# Reporte de cierre — segunda campaña

**Corte:** 2026-11-25
**Rama de trabajo:** `feat/campaign-2-stabilization`
**Commit base:** `6eda78935fdf4aa2bcd96976f59af628a294f13f`
**Estado Git:** cambios locales sin commit ni push. `.agents/` y
`skills-lock.json` permanecen sin rastrear y no forman parte de la entrega.

> **Documento histórico.** Conserva evidencia de la campaña anterior. No describe
> el funcionamiento vigente: el «catálogo oficial» fue retirado y Medusa es la
> fuente única de verdad. Ver `docs/90-MIGRACION-CATALOGO-LEGACY.md`.

## 1. Resumen ejecutivo

La campaña cerró los frentes que no dependen de infraestructura externa:

- falso positivo de Gitleaks corregido en las plantillas;
- preflight de runtime por entorno, con sesiones Redis separadas del caching;
- Search MXN con esquema, resolución de eventos y pruebas;
- inventario, promociones, pedido de laboratorio y cancelación probados contra PostgreSQL
  descartable;
- catálogo oficial mexicano con 35 productos/61 variantes, inventario inicial de
  laboratorio, storefront accesible y runbook reproducible;
- revalidación CMS autenticada Medusa → Next.js con HMAC;
- readiness real contra PostgreSQL y OpenTelemetry opt-in;
- documentación de staging, riesgos y bloqueos.

No se desplegó nada, no se pagó nada, no se modificó stock ni pedidos reales, no
se activaron Redis/S3 y no se hizo commit.

## 2. Estado del repositorio

| Elemento | Estado |
|---|---|
| Rama | `feat/campaign-2-stabilization` |
| `main` local/remoto | `c61edc8709c62f36a1f54516dd5de9087301fc34` |
| Cambios | Sin commit, listos para revisión |
| Artefactos de skills | `.agents/`, `skills-lock.json` sin rastrear |
| Secretos en diff | Sin coincidencias |

## 3. Skills utilizadas

| Skill | Decisión influida |
|---|---|
| `building-with-medusa` | Usar módulos/workflows nativos; no crear comercio paralelo |
| `implementation-plan` | Slices por frente y validación entre incrementos |
| `project-conventions` | Mantener `@jovy/*`, `@admin/*`, español en docs |
| `database-migration-review` | No editar migraciones aplicadas; Search por esquema versionado |
| `secure-coding` / `security-review` | HMAC, timestamp, allowlist, preflight de secretos |
| `testing-strategy` | Unitarias puras + integración contra PostgreSQL real |
| `code-review` | Revisión de diff, límites y casos negativos |
| `documentation` | Evidencia y estados sin inflar resultados |
| `find-docs` / docs de Next.js 16 | `revalidateTag(tag, { expire: 0 })`, sin APIs obsoletas |
| `modern-web-guidance` | Tarjetas con enlace nativo, radios accesibles y `<progress>` para carga |
| `api-design` | Marcador aditivo de catálogo completo en `/store/jovy/products` |

## 4. Archivos principales modificados

Backend:

- `apps/backend/medusa-config.ts`
- `apps/backend/.env.example`
- `apps/backend/.env.template`
- `apps/backend/instrumentation.ts`
- `apps/backend/src/lib/jovy/runtime-configuration.ts`
- `apps/backend/src/lib/jovy/runtime-preflight.ts`
- `apps/backend/src/lib/jovy/content-revalidation.ts`
- `apps/backend/src/subscribers/jovy-content-revalidation.ts`
- `apps/backend/src/api/middlewares.ts`
- `apps/backend/src/api/health/ready/route.ts`
- `apps/backend/src/search/helpers/pricing.ts`
- `apps/backend/src/search/helpers/resolve-product-ids.ts`
- `apps/backend/src/search/product.ts`
- `apps/backend/src/api/__tests__/middlewares.test.ts`
- tests nuevos en `src/lib/jovy/__tests__/`
- `apps/backend/integration-tests/http/commerce-operations.spec.ts`

Storefront:

- `apps/storefront/src/app/api/revalidate/route.ts`
- `apps/storefront/.env.example`

Documentación: `docs/77` a `docs/86` y actualizaciones de `docs/76` y `docs/88`.

## 5. Arquitectura resultante

```text
Storefront Next.js
  ├── /api/revalidate  ← HMAC ← subscriber Medusa
  └── use cache + cacheTag("jovy-content")

Medusa server
  ├── /admin/* → jovy-authz → observer de contenido
  ├── /store/* → comercio nativo
  └── /health/ready → PostgreSQL

Medusa worker (cuando se active Redis)
  └── event bus → jovy-content.changed → entrega firmada

Infraestructura opt-in
  ├── Redis: eventos, workflows, caché, locking, sesiones
  └── S3-compatible: File Module
```

No se creó otro backend, otra tabla de comercio, otro carrito, otro pedido ni otro
sistema de inventario.

## 6. Gitleaks y CI

- Hallazgo confirmado con Gitleaks 8.30.1 sobre el commit base: regla
  `generic-api-key`, archivo `apps/backend/.env.example`, línea 36.
- Valor afectado: placeholder `REPLACE_WITH_S3_SECRET`, no una credencial.
- Corrección: `# S3_SECRET_ACCESS_KEY=` vacío y comentario de gestor de
  secretos.
- Escaneo del árbol corregido: 0 hallazgos.
- No se desactivó Gitleaks ni se agregó exclusión global.
- CI no se re-ejecutó porque no se hizo commit/push. No se declara verde.

## 7. Configuración runtime

- `DEPLOYMENT_ENV` explícito: `development`, `staging`, `production`.
- Preflight estricto solo con perfil explícito; el build local no exige Redis,
  S3 ni HTTPS.
- Reglas: PostgreSQL válido, secretos fuertes y distintos, CORS exactos,
  cookies seguras, Redis compartido si server/worker están separados, S3
  persistente en despliegue.
- `SESSION_REDIS_URL` se asigna a `projectConfig.redisUrl`; no se confunde con
  Caching.
- Redis huérfano (URLs definidas con `MEDUSA_REDIS_ENABLED` falso) falla.
- `WORKER_MODE` normalizado y validado.

## 8. Search MXN

- `PRICE_CURRENCIES = ["mxn", "eur", "usd"]`.
- Campos MXN con filtro, orden, faceta y recuperación.
- Eventos de Price List agregados; resolución por `price_set.variant.product_id`.
- Se corrigieron comentarios obsoletos sobre workflows que sí emiten eventos en
  2.22.6.
- Limitación: una Price List que cruza vigencia no emite evento; falta política
  de reindexación programada.
- Migración de esquema observada en la suite: versión nueva, seed y activación.

## 9. Sincronización de índices

| Cambio | Cobertura |
|---|---|
| Producto | `product.*` |
| Variante / opciones / tags / categorías | eventos nativos |
| Canal / categoría con productos | `product.updated` |
| Precios de variante | `product-variant.updated` |
| Price List y sus precios | eventos nativos 2.21.3+ |
| Vigencia temporal | Pendiente de job/política |

## 10. Inventario

- Stock insuficiente rechazado al agregar.
- Backorder permitido solo con `allow_backorder=true`.
- Tres reservas concurrentes contra stock 2: 2 aceptadas, 1 rechazada.
- Hallazgo: el servicio directo `createReservationItems` no aplica locking; el
  workflow oficial sí. Producción debe usar el workflow.
- Catálogo oficial: 61 variantes con 50 unidades iniciales en `Jovy México
  Laboratorio`; seed y reposición usan locking y preservan reservas/ajustes.

## 11. Promociones

- Cupón porcentual aplicado y retirado con totales de Medusa.
- Código inválido rechazado.
- Promoción inactiva sin descuento o rechazada.
- Elegibilidad por producto respetada.
- No se creó UI de cupón ni gestor paralelo.

## 12. Pedidos

- Pedido de laboratorio completado con `pp_system_default` y envío manual.
- Cancelación Admin persistida: `pending` → `canceled`.
- Sin cobro, captura, fulfillment real, devolución ni reembolso.
- No se creó un segundo administrador de pedidos.

## 13. CMS y revalidación

- Observer autenticado en `/admin/*`, después de `jovy-authz`.
- Evento `jovy-content.changed`; subscriber firma HMAC SHA-256.
- Endpoint Next.js: timestamp ±300 s, cuerpo ≤4 KB, allowlist `jovy-content`.
- `revalidateTag("jovy-content", { expire: 0 })`.
- Reintentos 250/1000 ms; fallo no bloquea publicación; TTL como respaldo.
- Smoke real: `202` válido, `401` inválido.

## 14. Redis

**PREPARADO SIN EJECUTAR.** No hay Redis autorizado; puerto 6379 cerrado.
Configuración, preflight y comandos documentados. No se declara validación de
eventos, workflows, caché, locking ni reconexión.

## 15. Server/Worker

**PREPARADO SIN EJECUTAR.** Medusa 2.22.6 ya separa API/Admin de worker.
No se añadió lógica redundante. Falta probar reinicio, recuperación y ausencia
de procesamiento duplicado con Redis real.

## 16. S3

**BLOQUEADO.** Sin bucket ni credenciales. Se validó solo el rechazo de
configuración incompleta o insegura. No se migraron medios.

## 17. Observabilidad

- `/health/ready` comprueba PostgreSQL; probado en integración HTTP.
- OTel opt-in con exporter de consola; instrumenta HTTP, workflows, Query
  Graph, PostgreSQL y cache.
- OTLP queda bloqueado hasta aprobar una dependencia.
- Alertas propuestas en `docs/83`.

## 18. Seguridad

- HMAC, timestamp, allowlist y límite de cuerpo en revalidación.
- Preflight rechaza HTTP, loopback, comodines CORS, secretos débiles o repetidos.
- Secretos de revalidación solo de servidor.
- No se registran cuerpos ni secretos.
- `jovy-authz` se mantiene antes del observer.
- Aislamiento B2C entre dos clientes: cobertura parcial; no se añadió suite nueva.

## 19. Pruebas ejecutadas

| Comando | Entorno | Resultado |
|---|---|---|
| `pnpm --dir apps/backend test:unit` | local | 451/451 PASS |
| `pnpm --dir apps/backend test:integration:modules` | PostgreSQL descartable | 47/47 PASS |
| `pnpm --dir apps/backend test:integration:http` | PostgreSQL descartable | 104/104 PASS |
| `pnpm --filter @dtc/backend typecheck` | local | PASS |
| `pnpm --filter @dtc/backend build` | local | PASS |
| `pnpm --filter @dtc/backend lint` | local | 0 errores, 2 warnings preexistentes |
| `pnpm --filter storefront typecheck` | local | PASS |
| `pnpm --filter storefront build` | local | PASS |
| `pnpm --filter storefront lint` | local | 0 errores, 32 warnings preexistentes |
| Smoke `/api/revalidate` | `next start` real | 202/401 PASS |
| Gitleaks archivos nuevos/corregidos | local | 0 hallazgos |
| Hadolint | Dockerfiles | PASS |
| Actionlint | workflows CI/staging | PASS |
| YAML + `sh -n` | artefactos staging | PASS |
| Paquete backend compilado | resolución `@jovy/*` sin TS | PASS |
| Next.js standalone | servidor real | PASS |
| Boot Compose completo | local | NO EJECUTADO; gate preparado en CI |
| Storefront E2E | local | 30/30 PASS |
| Admin E2E | local | NO EJECUTADO |

Warnings preexistentes del backend: dos `eslint-disable` sin uso en
`.test-results/audit-headings/audit.cjs`. Warnings del storefront: uso de
`<img>` y una variable sin uso; no son errores de esta campaña.

## 19.1 Catálogo oficial de México

- Snapshot verificable: 61 presentaciones, 35 productos, 61 variantes, 24
  familias y 173 medios verificados.
- Seed `--preview`/`--apply`, Locking Module, resolución por SKU y preservación de
  precios, stock, reservas y ajustes manuales.
- Apertura de 50 unidades por variante en `Jovy México Laboratorio`.
- Nueva suite de integración: 2/2 PASS en PostgreSQL descartable.
- Storefront: colección oficial aislada de históricos, paginación, filtros por
  presentación, precio mínimo, descripción/especificaciones, stock máximo,
  estados accesibles y capa `layered` de Rings preservada.
- Runbook: `docs/90-MIGRACION-CATALOGO-LEGACY.md`.

Los precios son sintéticos y no autorizados para venta. No se ejecutaron pagos,
envíos ni operaciones productivas.

## 20. Migraciones

- No se añadieron migraciones de base de datos.
- No se editaron migraciones aplicadas.
- El cambio de esquema de Search se validó en base descartable con reindexación
  automática.
- No se ejecutó `db:migrate:search` sobre la base de desarrollo compartida.

## 21. Staging

**PREPARADO, NO DESPLEGADO.** Faltan PostgreSQL aislado, Redis si se activa,
bucket si se activa, TLS/proxy, secretos por ambiente, backup, restauración y
aprobación operativa.

## 22. Riesgos

1. Vigencia de Price Lists sin evento puede dejar precios desfasados.
2. Reservas directas al servicio sin locking pueden sobrevender.
3. Lock de video en memoria no cubre múltiples instancias.
4. Revalidación best-effort depende del TTL si el storefront está caído.
5. Sin Redis real no se probó recuperación de worker ni locking distribuido.
6. Sin aislamiento B2C nuevo, la cobertura de privacidad entre clientes es
   parcial.
7. CI no se re-ejecutó; Gitleaks está corregido solo en el árbol local.
8. La suite Playwright del Admin no se ejecutó; storefront sí completó 30/30.

## 23. Decisiones pendientes

- Autoridad de inventario.
- Fuente y vigencia de precios MXN.
- Proveedor de pago y política de reembolsos.
- Transportista, tarifas y devoluciones.
- Fiscalidad/CFDI.
- Storage, CDN y retención.
- Redis y topología de staging.
- Plataforma de observabilidad.

## 24. Bloqueos reales

| Frente | Bloqueo |
|---|---|
| Redis | Sin servicio autorizado |
| S3 | Sin bucket ni credenciales |
| Worker separado | Depende de Redis |
| Staging | Sin infraestructura ni TLS |
| Producción | Sin proveedores, backup, restauración ni protección de rama |
| Pagos/logística/fiscal | Sin decisión comercial |

## 25. Trabajo no ejecutado

- Redis real, S3 real, worker reiniciado, backup/restore.
- Reindexación programada por vigencia de Price Lists.
- UI de cupón en storefront.
- Fulfillment, devolución y refund reales.
- Suite nueva de aislamiento B2C.
- Commit, push y re-ejecución de CI.

## 26. Dictamen staging

**NO-GO para desplegar.** La plataforma está más preparada y tiene pruebas
reales de comercio, pero no existe infraestructura aislada ni recuperación
validada.

## 27. Dictamen producción

**NO-GO.** Faltan pagos/logística/fiscal autorizados, inventario confiable,
storage persistente, observabilidad operativa, backup/restauración y
protección de `main`.

## 28. Próximos pasos

1. Revisar el diff y decidir commit.
2. Re-ejecutar CI y confirmar Gitleaks.
3. Aprobar topología de staging y responsables.
4. Autorizar Redis y S3 aislados o mantener perfiles locales explícitos.
5. Definir autoridad de inventario y precios MXN.
6. Añadir política de reindexación por vigencia.
7. Ampliar pruebas de aislamiento B2C y observabilidad.
