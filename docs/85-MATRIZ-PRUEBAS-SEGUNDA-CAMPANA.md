# Matriz de pruebas de la segunda campaña

**Corte:** 2026-11-25
**Entorno:** Windows local, Node 24.16.0, pnpm 11.17.0, PostgreSQL local.
**Base de integración:** bases descartables creadas por `@medusajs/test-utils`.

> **Documento histórico.** Describe la campaña anterior al retiro del subsistema
> «catálogo oficial». La arquitectura vigente es Medusa como fuente única de
> verdad y la migración manual descrita en `docs/90-MIGRACION-CATALOGO-LEGACY.md`.

## Escenarios obligatorios

| Escenario | Resultado | Evidencia |
|---|---|---|
| Search MXN | PASS | `mxn` en `PRICE_CURRENCIES`; campos y consulta por moneda |
| Precio actualizado | PASS (por evento) | `product-variant.updated` y eventos de Price List |
| Producto fuera de canal | PASS | Filtro existente de `sales_channel_ids` no se relajó |
| Inventario insuficiente | PASS | Agregar 2 con stock 1 → 400 |
| Backorder prohibido | PASS | `allow_backorder=false` rechaza |
| Backorder permitido | PASS | `allow_backorder=true` acepta |
| Concurrencia de reservas | PASS | 3 reservas contra stock 2 → 2 aceptadas |
| Promoción válida | PASS | 10% sobre 20 000 → descuento 2 000 |
| Promoción inválida | PASS | Código inexistente rechazado |
| Promoción inactiva | PASS | Sin descuento o rechazo |
| Elegibilidad por producto | PASS | Solo el producto elegible recibe 20% |
| Cancelación de pedido | PASS | `pending` → `canceled` persistido |
| Pago de laboratorio | PASS | `pp_system_default`, sin cobro |
| Revalidación CMS | PASS | `202` firmado; `401` firma inválida |
| Falla de revalidación | PASS (unitaria) | Reintentos y fallback por TTL |
| Redis temporalmente caído | NO EJECUTADO | Sin Redis autorizado |
| Reinicio de worker | NO EJECUTADO | Sin staging ni Redis |
| S3 no disponible | NO EJECUTADO | Sin bucket autorizado |
| Producto sin overlay | NO EJECUTADO en esta campaña | Sin cambio en esa ruta; E2E no completó |
| Cliente A accede a datos B | PARCIAL | Cobertura existente de authz; no se añadió suite B2C nueva |
| Storefront E2E | PASS | 30/30 catálogo, ficha, compra, móvil, visual y ES/EN |
| Admin E2E | NO EJECUTADO | No se ejecutó la suite Playwright del Admin |
| Runtime inseguro | PASS | Preflight rechaza CORS HTTP, loopback, secretos débiles |
| Gitleaks | PASS en árbol | Falso positivo corregido; CI pendiente de re-ejecutar |
| Importaci?n hist?rica idempotente y concurrente | PASS | `legacy-import.spec.ts`, PostgreSQL descartable |
| Apertura de inventario 50 | PASS | 61 niveles iniciales; segundo seed no repone |
| Precio/familia/título manual | PASS | Preservados en rerun |
| Nueva presentación y renombre oficial | PASS | Opción enlazada; identidad/handle reutilizados |
| MXN sobre price set existente | PASS | Moneda previa conservada |

## Comandos ejecutados

```powershell
pnpm --dir apps/backend test:unit
pnpm --dir apps/backend test:integration:modules
pnpm --dir apps/backend test:integration:http
pnpm --filter @dtc/backend typecheck
pnpm --filter storefront typecheck
pnpm --filter storefront build
```

## Resultados de esta campaña

| Suite | Resultado |
|---|---|
| Unitarias backend | 451/451 PASS, 49 suites |
| Integración de módulos | 47/47 PASS, 7 suites |
| Integración HTTP | 104/104 PASS, 14 suites |
| Suite nueva de comercio | 9/9 PASS |
| Importaci?n hist?rica nuevo | 2/2 PASS |
| Storefront E2E catálogo/visual | 30/30 PASS |
| Typecheck backend | PASS |
| Typecheck storefront | PASS |
| Build storefront | PASS |
| Build backend | Ver reporte de cierre |
| Smoke `/api/revalidate` | 202 válido / 401 inválido |
| Gitleaks árbol corregido | 0 hallazgos |
| Hadolint / Actionlint | PASS |
| YAML y sintaxis shell | PASS |
| Paquete backend compilado | PASS |
| Next.js standalone | PASS |
| Boot Compose completo | NO EJECUTADO local; workflow manual preparado |
| Gitleaks commit anterior | 1 falso positivo confirmado |

Las cifras son de esta ejecución, no históricas.

## Casos no sustituidos por mocks

- Promociones: Promotion Module real en PostgreSQL descartable.
- Inventario: Inventory Module real, niveles y reservas reales.
- Pedido: carrito, envío manual, payment collection y cancelación reales en la
  base de prueba.
- Revalidación: build real de Next.js y firma real contra `next start`.
- Runtime: configuración resuelta y preflight ejecutados con variables reales.

Redis, S3, worker separado, backup y restauración no se declaran probados porque
no existe infraestructura autorizada.
