# Auditoría y hardening de autorización

**Corte:** 2026-11-20
**Base:** `5332578` (`feat(admin): añade control de acceso integral por roles`)
**Cambios de esta fase:** sin commit, árbol de trabajo modificado.
**Alcance:** `jovy-authz`, `src/api/middlewares.ts`, rutas `/admin/jovy/authz/**`, pruebas y documentación.

## 1. Resumen

Se endureció la capa existente sin reconstruirla. Los cambios atacan cinco clases de fallo:

1. `deny` anulado por `*:*`.
2. Excepciones del shell evaluadas antes de la identidad.
3. Bootstrap automático durante peticiones.
4. Escrituras no transaccionales y auditoría engañosa.
5. Ambigüedad de rutas y lecturas con efectos secundarios.

No se activó RBAC Enterprise, no se modificó `node_modules`, no se usó CSS para simular permisos y no se tocaron datos operativos.

## 2. Cambios por archivo

### `src/lib/jovy/authz/permissions.ts`

- Añade `effectivePermissionKeys(allow, deny)` y `isGlobalAdmin(allow, deny)`.
- `wildcard` deja de ser `allow.has("*:*")`: exige ausencia total de denegaciones.
- `permissionAllows` conserva la precedencia de `deny` por recurso, operación y global.

### `src/lib/jovy/authz/route-policy.ts`

- Separa `SHELL_PUBLIC_READS` y `SHELL_AUTHENTICATED_READS`.
- Solo `GET/HEAD /admin/feature-flags` es público.
- `/admin/stores` se limita a `GET /admin/stores` y `GET /admin/stores/:id`.
- Añade `isAmbiguousPath` y lo aplica a reglas Jovy, rutas nativas y shell.
- `HEAD` se trata como lectura; las mutaciones siguen clasificadas por método.
- Exporta `SHELL_READ_PATTERNS` con ambos grupos para el catálogo de UI.

### `src/lib/jovy/authz/middleware.ts`

- Orden nuevo: ruta ambigua → excepción pública → identidad (`actor_type === "user"`) → usuario existente → snapshot → excepción autenticada → regla Jovy/nativa.
- `assertUserExists` se ejecuta en cada petición, fuera de la caché.
- El snapshot usa permisos efectivos y `isGlobalAdmin`.
- Un `MedusaError` de tipo `UNAUTHORIZED` responde 401; el resto, 403.
- Se eliminaron del middleware `ensureSystemRoles`, `ensureBootstrapAssignment` y la resolución de email.

### `src/api/admin/jovy/authz/me/route.ts`

- No siembra roles ni ejecuta bootstrap.
- Devuelve `permissions` efectivos y `wildcard` calculado.
- No anuncia operaciones anuladas por `deny`.

### `src/modules/jovy-authz/service.ts`

- Escrituras con el patrón oficial: `@InjectManager` público + `@InjectTransactionManager` protegido + `@MedusaContext`.
- Rol, políticas, asignaciones, excepciones y auditoría se confirman o revierten juntos.
- `ensureSystemRoles()` solo se invoca desde bootstrap/pruebas.
- `listRolesWithPolicies()` es lectura pura.
- Nuevo `assignBootstrapSuperadmin({ userId, mode })`:
  - `bootstrap` rechaza si ya hay Superadministrador;
  - `recovery` se acepta solo desde el comando con confirmación;
  - idempotente (`already`);
  - auditoría `bootstrap` en la misma transacción.
- `replaceUserAccess` bloquea retirar el último Superadministrador.
- Elimina `ensureBootstrapAssignment` y todo uso de `JOVY_AUTHZ_BOOTSTRAP_EMAILS`.

### `src/scripts/bootstrap-authz.ts` (nuevo)

Comando operativo:

```powershell
pnpm --dir apps/backend exec medusa exec ./src/scripts/bootstrap-authz.ts -- --user-id=usr_...
pnpm --dir apps/backend exec medusa exec ./src/scripts/bootstrap-authz.ts -- --user-id=usr_... --mode=recovery --confirm=recover-superadmin
```

Resuelve el usuario por ID o correo, siembra roles, valida el modo y llama al servicio. No lee privilegios de variables de entorno.

### `integration-tests/setup.js` y `integration-tests/http/utils.ts`

- Se elimina la variable de bootstrap.
- `createAdminUserSession` ejecuta la siembra y el bootstrap explícito para el administrador sintético de cada suite.
- El correo deja de ser un mecanismo de privilegio; solo identifica al usuario de prueba.

### Pruebas

- `permissions.test.ts`: wildcard con `deny`, expansión efectiva, `deny` exacto.
- `route-policy.test.ts`: shell público/autenticado, rutas ambiguas, `HEAD`, barra final, wildcard con `deny`.
- `cache.test.ts` (nuevo): TTL, expiración, invalidación por usuario y global.
- `inventory.test.ts`: cada área nativa referencia un recurso real y no se repite.
- `authz.integration.test.ts`: bootstrap, recuperación, último Superadministrador, `deny` sobre `*:*`.
- `integration-tests/http/authz.spec.ts`: shell, wildcard+deny, revocación y API key nativa.

### `.github/workflows/ci.yml` (nuevo)

- Typecheck backend y storefront, lint, unitarias y build.
- Integración de módulos y HTTP con PostgreSQL 16 como servicio.
- Detección de secretos con gitleaks y auditoría de dependencias informativa.

## 3. Decisiones

| Decisión | Motivo |
|---|---|
| Mantener `jovy-authz` | No hay licencia RBAC Enterprise y la capa cubre Jovy + nativo por prefijo. |
| `deny` siempre gana | Requisito de seguridad y coherencia con la matriz. |
| Bootstrap por comando | Evita elevación durante peticiones y deja rastro operativo. |
| Transacciones del framework | Menos código propio y compatible con Medusa. |
| `assertUserExists` sin caché | La eliminación de usuario debe surtir efecto inmediato. |
| Rechazar rutas ambiguas | La ruta autorizada debe ser la ruta ejecutada. |
| No parchear el dashboard | Sin licencia no hay mecanismo oficial para el sidebar. |

## 4. Estado

| Elemento | Estado |
|---|---|
| Precedencia `deny`/wildcard | **CORREGIDO · PROBADO** |
| Orden shell/identidad | **CORREGIDO · PROBADO** |
| Bootstrap automático | **ELIMINADO · REEMPLAZADO** |
| Comando de bootstrap/recuperación | **IMPLEMENTADO · PROBADO** |
| Transacciones de escritura | **IMPLEMENTADO · PROBADO** (sin prueba multiinstancia) |
| Auditoría de cambios | **IMPLEMENTADO · PROBADO** |
| Revocación local | **PROBADA** en el mismo proceso |
| Revocación distribuida | **PENDIENTE / BLOQUEADA** |
| Rutas ambiguas | **CORREGIDO · PROBADO** |
| Cobertura nativa | **PARCIAL · RIESGO ACEPTADO** |
| Sidebar nativo filtrado | **BLOQUEADO POR LICENCIA** |
| HTTPS/proxy/sesiones reales | **PENDIENTE** |
| Backup/recuperación | **PENDIENTE** |

## 5. Hallazgos no corregidos

- Filtrado de campos por rol: no implementado; no se devuelven campos ocultos solo en UI porque no existe esa ocultación hoy.
- Operaciones nativas sensibles comparten permiso de área (`medusa_orders:update` cubre cancelar, reembolsar, devolver y editar). La granularidad fina requiere RBAC oficial o un mapa por endpoint.
- Invalidación distribuida de caché y Redis: sin entorno.
- Validación HTTPS/cookies/proxy: sin staging.
- Sidebar nativo: bloqueado por licencia.

## 6. Compatibilidad

- No se modificaron migraciones aplicadas ni `pnpm-workspace.yaml`.
- La migración `Migration20261120100000` sigue siendo la única del módulo.
- Los contratos de respuesta existentes se conservan; `/authz/me` cambia el contenido de `permissions`/`wildcard` para reflejar permisos efectivos (cambio intencional y documentado).
- El comando de bootstrap es la única vía de inicialización.
