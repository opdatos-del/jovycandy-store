# Matriz de pruebas de seguridad

**Corte:** 2026-11-20
**Entorno:** PostgreSQL local, backend de pruebas creado por `@medusajs/test-utils`, usuarios y contactos sintéticos.
**Sin PII real.** No se exportaron ni copiaron los ~1.175 contactos locales.

## 1. Comandos ejecutados

```powershell
pnpm --filter @dtc/backend typecheck
pnpm --filter @dtc/backend lint
pnpm --dir apps/backend test:unit
pnpm --dir apps/backend test:integration:modules
pnpm --dir apps/backend test:integration:http
pnpm --dir apps/backend test:e2e
pnpm --filter @dtc/backend build
```

## 2. Resultados

| Check | Resultado |
|---|---|
| Typecheck backend | 0 errores |
| Lint backend | 0 errores; 2 warnings preexistentes en `.test-results` |
| Unitarias | **39 suites / 376 pruebas** |
| Integración de módulos | **7 suites / 47 pruebas** |
| Integración HTTP | **12 suites / 93 pruebas** |
| E2E navegador | **31/31** |
| Build backend + Admin | Correcto |

> Las unitarias y la integración se ejecutaron completas, no por archivo aislado. E2E usa el servidor de desarrollo en `127.0.0.1:9001`.

## 3. Matriz HTTP

Archivo: `apps/backend/integration-tests/http/authz.spec.ts` (17 escenarios).
Actores: `admin` (superadmin), `noRole`, `viewer`, `national`, `nationalNoExport`, `union`, `productViewer`, `accessReader`, `accessManager`, `contentEditor`, `wildcardDenied`, `revoked`.

| ID | Actor | Método y recurso | Permiso | Esperado | Observado | Estado |
|---|---|---|---|---|---|---|
| AC-01 | Anónimo | `GET /admin/jovy/dashboard` | — | 401 | 401 | PASS |
| AC-02 | Sin roles | `GET /admin/jovy/dashboard` | — | 403 | 403 | PASS |
| AC-03 | Sin roles | `GET /admin/jovy/authz/me` | authenticated | 200, permisos `[]`, wildcard `false` | 200, `[]`, `false` | PASS |
| AC-04 | Viewer | `GET /admin/jovy/dashboard` | `jovy_dashboard:read` | 200 | 200 | PASS |
| AC-05 | Viewer | `GET /admin/jovy/contacts` | ninguna bandeja | 403 | 403 | PASS |
| AC-06 | Viewer | `GET /admin/jovy/authz/roles` | `jovy_access:read` | 403 | 403 | PASS |
| AC-07 | Nacional | `GET /contacts?contact_type=national-sales` | read nacional | 200, solo su bandeja | 200 | PASS |
| AC-08 | Nacional | `GET /contacts?contact_type=international-sales` | read internacional | 403 | 403 | PASS |
| AC-09 | Nacional | `GET /contacts` consolidado | cuatro bandejas | 403 | 403 | PASS |
| AC-10 | Nacional | `GET /contacts/counts` | cuatro bandejas | 403 | 403 | PASS |
| AC-11 | Nacional | `GET/PUT/GET audit /contacts/:id` ajeno | tipo real | 404 | 404 | PASS |
| AC-12 | Nacional | `PUT /contacts/:id` propio | update nacional | 200 | 200 | PASS |
| AC-13 | Nacional sin export | `GET /contacts/export?contact_type=national-sales` | `export` | 403 | 403 | PASS |
| AC-14 | Dos bandejas | `GET /contacts/export-all?contact_types=national-sales,international-sales` | export de ambas | 200 | 200 | PASS |
| AC-15 | Dos bandejas | `GET /contacts/export-all` sin tipos | export de las cuatro | 403 | 403 | PASS |
| AC-16 | Consulta productos | `GET /admin/products` | `medusa_products:read` | 200 | 200 | PASS |
| AC-17 | Consulta productos | `POST /admin/products` | create | 403 | 403 | PASS |
| AC-18 | Consulta productos | `GET /admin/users` | `medusa_users:read` | 403 | 403 | PASS |
| AC-19 | Consulta productos | `GET /admin/users/me` | shell autenticado | 200 | 200 | PASS |
| AC-20 | Consulta productos | `GET /admin/authz-unknown` | no clasificada | 403 | 403 | PASS |
| AC-21 | Lector de accesos | `PUT /authz/roles/:id/policies` | `manage_settings` | 403 | 403 | PASS |
| AC-22 | Admin | `PUT /authz/users/:self` | autoedición | 403 | 403 | PASS |
| AC-23 | Gestor de accesos | Crear rol con permiso superior | delegación | 403 | 403 | PASS |
| AC-24 | Gestor de accesos | Editar su propio rol | autoedición | 403 | 403 | PASS |
| AC-25 | Gestor de accesos | Asignar `superadmin` a otro | escalamiento | 403 | 403 | PASS |
| AC-26 | Nacional | `GET /authz/navigation` | — | solo grupo Jovy y su bandeja | Correcto | PASS |
| AC-27 | Consulta productos | `GET /authz/navigation` | — | solo grupo Medusa | Correcto | PASS |
| AC-28 | Admin | `GET /authz/audit` | `jovy_access:read` | 200, sin secretos | 200 | PASS |
| AC-29 | Editor de contenido | `PUT /content/pages/:id` con `published` | update + publish | 403 | 403 | PASS |
| AC-30 | Editor de contenido | `PUT /content/pages/:id` con `draft` | update | 200 | 200 | PASS |
| AC-31 | Anónimo | `GET /admin/stores` | shell | 401 | 401 | PASS |
| AC-32 | Anónimo | `GET /admin/feature-flags` | shell público | 200 | 200 | PASS |
| AC-33 | Sin roles | `GET /admin/stores` | shell autenticado | 200 | 200 | PASS |
| AC-34 | Sin roles | `POST /admin/stores` | `medusa_settings:manage_settings` | 403 | 403 | PASS |
| AC-35 | `*:*` + deny `medusa_users:manage_settings`, `jovy_contacts_national:export` | `GET /authz/me` | — | sin `*:*`, sin permisos denegados | Correcto | PASS |
| AC-36 | Igual | `GET /admin/products` | wildcard efectivo | 200 | 200 | PASS |
| AC-37 | Igual | `POST /admin/users` | denegado | 403 | 403 | PASS |
| AC-38 | Igual | `GET /contacts/export?contact_type=national-sales` | denegado | 403 | 403 | PASS |
| AC-39 | Usuario revocado | `GET /admin/jovy/dashboard` antes/después de retirar rol | — | 200 → 403 | 200 → 403 | PASS |
| AC-40 | API key secreta | `GET /admin/jovy/dashboard` | actor `user` | 401 | 401 | PASS |
| AC-41 | API key secreta | `GET /admin/products` | actor `user` | 401 | 401 | PASS |

## 4. Matriz de módulo

Archivo: `src/modules/jovy-authz/__tests__/authz.integration.test.ts` (10 pruebas).

| ID | Caso | Esperado | Estado |
|---|---|---|---|
| AM-01 | Siembra idempotente de roles | No duplica y conserva `*:*` de superadmin | PASS |
| AM-02 | Unión de roles + `deny` individual | `deny` bloquea export y `read` sigue permitido | PASS |
| AM-03 | Revocación al reasignar | Sin roles ni políticas | PASS |
| AM-04 | Rol asignado / rol de sistema | No se elimina | PASS |
| AM-05 | Política fuera del catálogo | Rechazada | PASS |
| AM-06 | Auditoría de cambio | Registro con actor y sin secretos | PASS |
| AM-07 | Bootstrap explícito | `created` y luego `already`; auditoría `bootstrap` | PASS |
| AM-08 | Segundo bootstrap y último superadmin | Rechazados | PASS |
| AM-09 | Recuperación explícita | `recovery` crea asignación con auditoría | PASS |
| AM-10 | `deny` sobre `*:*` | `isGlobalAdmin=false`, permisos efectivos sin lo denegado | PASS |

## 5. Matriz unitaria relevante

| ID | Archivo | Caso | Estado |
|---|---|---|---|
| AU-01 | `permissions.test.ts` | `deny` gana a allow exacto y a `*:*` | PASS |
| AU-02 | `permissions.test.ts` | permisos efectivos no anuncian `*:*` con deny | PASS |
| AU-03 | `route-policy.test.ts` | shell público vs. autenticado y `/admin/stores` acotado | PASS |
| AU-04 | `route-policy.test.ts` | rutas ambiguas, `..`, `HEAD`, barra final y query | PASS |
| AU-05 | `route-policy.test.ts` | wildcard con deny bloquea mutación nativa | PASS |
| AU-06 | `inventory.test.ts` | todo `route.ts` y método tiene regla | PASS |
| AU-07 | `inventory.test.ts` | áreas nativas con recurso/operación reales | PASS |
| AU-08 | `cache.test.ts` | TTL 15 s, expiración e invalidación | PASS |

## 6. Pruebas E2E

- 31/31 escenarios del Admin, incluidas navegación, contactos, contenido, marketing, marca, eventos, lanzamientos y novedades.
- No se ejecutó un E2E multirol con cuentas DEMO independientes en navegador. La matriz multirol se cubre por HTTP.
- No se tomaron capturas con PII.

## 7. Brechas de la matriz

| Brecha | Estado |
|---|---|
| HTTPS, proxy, cookies reales, CSRF | PENDIENTE (sin staging) |
| Revocación entre dos instancias | PENDIENTE / BLOQUEADA |
| Concurrencia real de dos administradores sobre el mismo rol | No ejecutada con dos procesos; transacción cubierta por diseño y pruebas de fallo |
| Fallo de PostgreSQL durante una escritura | No ejecutado de forma destructiva |
| Backup/restore | PENDIENTE |
| Cuentas de servicio / API keys internas | PENDIENTE |
| Filtrado por campo | PENDIENTE |
| Usuario “deshabilitado” | Medusa 2.22.6 no expone un flag nativo; se cubre eliminando el usuario (comprobado por petición) o retirando roles |
| Sidebar nativo filtrado | BLOQUEADO POR LICENCIA |

Un resultado verde no equivale a un pentest independiente.
