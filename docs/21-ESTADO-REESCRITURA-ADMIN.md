# Estado — reescritura administrativa en Medusa

**Corte:** 2026-11-13. **Alcance:** `apps/backend` (Medusa 2.22.6), módulos `jovy-*`,
Admin propio y APIs Store. Lo que no tiene evidencia ejecutada se declara pendiente.

## Estado por área

| Área | Estado real | Evidencia verificable | Pendiente concreto |
| --- | --- | --- | --- |
| PostgreSQL y migraciones Medusa | IMPLEMENTADO Y VALIDADO | `medusa db:migrate` contra `jovycandy_prototipo_medusa`; migraciones de Content, Marketing, Events (`20261113090000`, `20261113093000`), Brand y Contacts aplicadas sin reinicializar la base | Ninguno de infraestructura local. Las migraciones son append-only. |
| Contenido editorial | IMPLEMENTADO Y VALIDADO | E2E `jovy-content.spec.ts`: login, validación, alta, duplicado, edición, publicación, Store API, archivado, auditoría y borrado lógico | UI de SEO y `published_at`; ver matriz `docs/24`. |
| Marketing: Hero | IMPLEMENTADO Y VALIDADO | E2E `jovy-hero.spec.ts`: negativos HTTP, PNG/JPEG/WebP reales, >5 MB/SVG/firma falsa/MIME incoherente/PNG corrupto/sin archivo, persistencia de media y color global, reorden visible en Store, Product Link A→B→null idempotente con compensación | Assert explícito de `cta_url` y de color por elemento en E2E. |
| Marketing: Banners | IMPLEMENTADO Y VALIDADO | E2E `jovy-banners.spec.ts`: slots, prioridad/orden, frecuencia, ventana UTC, `auto_open`, CTA, negativos `400`, edición, archivo y reordenamiento desde UI | El storefront aún no interpreta `frequency`/`auto_open`; es decisión de presentación (`docs/25`). |
| Eventos | IMPLEMENTADO Y VALIDADO | E2E `jovy-events.spec.ts`: gate de publicación, `title_en`, `cancelled`/futuro/pasado fuera de Store, tipos con GET/PUT/DELETE y bloqueo de borrado en uso, multimedia PNG/JPEG con reemplazo/retiro, reorden restringido por prioridad | Prueba de concurrencia del `code` único de tipos; detalle Store por `slug` y "próximos eventos" (`docs/25`). |
| Galería Casa Jovy y Logos | IMPLEMENTADO Y VALIDADO | E2E `jovy-brand.spec.ts`; integración con Locking Module PostgreSQL: límite de 4 con concurrencia, ventanas cerradas `[start,end]`, bordes exactos, 5.º rechazado también por update; crop no destructivo, archivo/desactivación sin borrar medios compartidos, `media_file_id` inexistente → `NOT_FOUND`; tope defensivo de 4 en lectura Store con warning sin PII | E2E exclusiva del límite; no hay borrado físico de medios. |
| Contactos | IMPLEMENTADO Y VALIDADO PARCIALMENTE | E2E `jovy-contacts.spec.ts`; integración `contacts-query.integration.test.ts`: `take`/`skip` + `limit` máx 100, orden estable, filtros SQL con escape de `%`/`_`, envelope `{contacts,count,limit,offset}`, `429` con `Retry-After`, soft delete y auditoría con whitelist | Rate limit en memoria (solo laboratorio); sin exportación; sin restauración/purga automática (`docs/26-RETENCION-CONTACTOS.md`). |
| RBAC fino / roles | PENDIENTE | `@medusajs/rbac` existe en 2.22.6 pero el módulo no está registrado en `medusa-config.ts`; `authorize`/`hasPermission` son no-op; diseño en `docs/19-SEGURIDAD-ADMIN.md` | Registrar RBAC, crear políticas `jovy_*`, asignar roles y añadir guardas por ruta. Sin eso no hay separación de funciones. |
| Medios | IMPLEMENTADO PARCIALMENTE | Ruta Admin con Multer en memoria (5 MB), firma, MIME y `sharp`; E2E de subida y negativos | Sin `DELETE`, sin video, sin conteo de referencias; los archivos locales son públicos. |
| Store API y publishable key | IMPLEMENTADO Y VALIDADO | E2E de las seis specs contra `/store/jovy/*`; sin key la respuesta es `400` antes del handler | Cerrar los gaps de contrato de `docs/25` (producto destacado, detalle de evento, paginación). |
| Paridad con el administrador histórico | AUDITADA | `docs/24-MATRIZ-PARIDAD-ADMIN.md`: 69 filas, 37 validadas, 9 parciales, 7 nativas, 13 pendientes, 3 descartadas | Producto editorial, RBAC, ciclo de medios, exportación/restauración y configuración corporativa. |

## Regresión consolidada

Ejecutada el 2026-11-13 sobre el árbol de trabajo, sin commits nuevos:

| Comprobación | Resultado |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm --dir apps/backend test:unit` | 15 suites / 95 pruebas OK |
| `pnpm --dir apps/backend test:integration:modules` | 3 suites / 16 pruebas OK |
| `pnpm build` | OK (backend + storefront) |
| `pnpm --dir apps/backend test:e2e` | 13 pruebas / 0 fallos / 2,0 min en un solo comando |

- `test:integration:http`: 5 suites / 19 pruebas OK (162,8 s) contra bases desechables; cubre contactos Store/Admin/rate limit, contenido Store y marketing Store/Hero/Banners.
- Playwright agrupado quedó verde en corridas consecutivas: 6/6 previa y 13/13 en la última corrida.
- `test:integration:modules` incluye `jovy-content`, `jovy-brand` y `jovy-contacts` contra PostgreSQL real; usa bases desechables de `@medusajs/test-utils`.

## Playwright: causa raíz y corrección

Causa demostrada: el watcher de `medusa develop` reinicia el servidor ante cualquier archivo
escrito bajo `apps/backend` que no esté en su lista ignorada (`node_modules`, `dist`, `static`,
`private`, `src/admin`, `.medusa`, dotfiles). Playwright escribía capturas, trazas y reportes en
`test-results/` y `playwright-report/`; el reinicio mataba el proceso hijo del puerto 9001 y las
pruebas siguientes fallaban con `ECONNRESET`/`ECONNREFUSED`.

Corrección aplicada en `apps/backend/playwright.config.ts`:

- Artefactos en `.test-results/playwright` y `.playwright-report` (dotfiles ignorados por el watcher).
- `PLAYWRIGHT_BROWSER_EXECUTABLE` tiene prioridad; si no está definido se buscan las rutas de
  instalación de Brave y se documenta el fallback.
- Dos flakes reales corregidos: `expect.poll` en Brand y verificación del badge persistente en
  Contactos.
- `workers: 1` se mantiene porque PostgreSQL es compartido.

## Seguridad y RBAC

Gap real: Medusa 2.22.6 incluye `@medusajs/rbac`, pero el módulo **no** está registrado en
`medusa-config.ts`. Sin registro, `authorize` no hace nada y `hasPermission` devuelve `true`: toda
sesión `user` o API key secreta es admin pleno sobre contenido, marketing, eventos, marca,
contactos (incluida PII) y configuración. El diseño de recursos `jovy_*`, roles propuestos y guardas
por ruta está documentado en `docs/19-SEGURIDAD-ADMIN.md`; **no está implementado**.

Para producción falta: registrar el módulo, ejecutar migraciones, crear políticas de dominio,
reasignar usuarios fuera de Super Admin, añadir `authorize` por método/ruta y probar denegaciones.
También siguen abiertos el rate limit compartido de contactos, el filtrado de campos PII y el
tratamiento de API keys como credenciales de máquina. Detalle y hallazgos: `docs/19`.

## Paridad

Resumen de `docs/24-MATRIZ-PARIDAD-ADMIN.md`: 69 filas auditadas; 37 implementadas y validadas,
9 parciales, 7 resueltas por Medusa nativo, 13 pendientes y 3 descartadas justificadamente. Las
brechas que bloquean paridad real son producto editorial (familia, gramaje, certificaciones,
orden, restauración), RBAC, ciclo de vida de medios y exportación/retención de contactos. La matriz
contiene el detalle por fila y el conteo por módulo; no se duplica aquí.

## Contratos para storefront

El contrato de consumo está en `docs/25-CONTRATOS-STOREFRONT.md`. Regla vigente: el storefront
consume **solo** `/store/jovy/*` (y rutas nativas `/store/*` cuando aplique). Está prohibido llamar
`/admin/jovy/*`: exige sesión, devuelve borradores, auditoría y PII.

Puntos consolidados del contrato: publishable key obligatoria; Eventos devuelve `title_en` y el
gate de publicación exige título ES, `title_en`, tipo existente, `starts_at` y rango coherente;
contacto responde `429` con `Retry-After`; las listas Store no paginan. Gaps abiertos (producto
destacado en Hero, detalle de evento por `slug`, "próximos eventos", paginación, `event_type`
completo) están en `docs/25` §9 y §10.

## Riesgos para producción

| Riesgo | Impacto | Estado |
| --- | --- | --- |
| RBAC apagado | Cualquier admin o API key accede a todo, incluida PII | Bloqueante |
| Rate limit de contactos en memoria | Bypass por reinicio o múltiples instancias | Bloqueante si el formulario se expone |
| File Module local y público | Archivos accesibles sin control; no apto para material sensible | Bloqueante para medios privados |
| Sin borrado ni conteo de referencias de medios | Huérfanos y crecimiento no acotado | Pendiente, no bloqueante |
| Sin restauración ni purga automática de contactos | La retención de `docs/26` es manual | Bloqueante para cumplimiento de privacidad |
| Contrato Store incompleto | Sin producto destacado, detalle de evento ni agenda futura | Funcional, no de seguridad |
| Despliegue no evaluado | No hay Docker, despliegue ni auditoría de CORS/secretos de producción | Fuera del alcance local |

## Estado de Git

- `HEAD` = `origin/main` = `829b9e5` (`feat(cms): add brand gallery, logos and contacts modules`).
- No se crearon commits ni se hizo push en esta consolidación.
- Árbol de trabajo con cambios sin commitear: código y specs de `apps/backend` modificados,
  migración `20261113093000`, pruebas nuevas, `AGENTS.md` y documentación (`docs/17`, `docs/19`,
  `docs/23`, `docs/24`, `docs/25`, `docs/26`, este documento).
- `apps/backend/static/` es runtime del provider `file-local` y no se versiona.
