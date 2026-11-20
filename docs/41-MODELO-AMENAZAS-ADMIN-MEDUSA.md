# Modelo de amenazas del Admin de Medusa

**Proyecto:** JovyCandy 3.0 · Medusa v2 `2.22.6` + PostgreSQL
**Corte:** 2026-11-20
**Alcance:** `/admin/**`, extensiones `jovy-*`, identidad, permisos, contactos, exportaciones, auditoría y configuración de sesión.
**Método:** revisión de código, pruebas HTTP reales con usuarios sintéticos y pruebas unitarias. No se ejecutó un pentest externo.

## 1. Activos

| Activo | Dónde vive | Sensibilidad |
|---|---|---|
| Identidad administrativa | User + Auth Modules de Medusa | Alta |
| Sesiones y cookies | JWT/cookie de Medusa | Alta |
| Roles, políticas y asignaciones | `jovy_authz_*` | Alta |
| Permisos efectivos | Cálculo en middleware | Alta |
| Productos, precios, inventario y pedidos | Módulos nativos | Alta |
| Solicitudes de contacto (4 bandejas) | `jovy_contact_request` | Alta (PII) |
| Exportaciones CSV/XLSX | Rutas `/admin/jovy/contacts/export*` | Alta |
| API keys | API Key Module | Alta |
| Auditoría de accesos | `jovy_authz_audit_log` | Media |
| Secretos y configuración | `.env`, `medusa-config.ts` | Alta |
| Medios subidos | File Module local (`static/`) | Media |

## 2. Actores

- Anónimo.
- Usuario autenticado sin roles.
- Operador restringido (consulta CMS, ventas de una bandeja, consulta de productos).
- Administrador de accesos (`jovy_access:manage_settings`) sin wildcard.
- Superadministrador (`*:*`), con o sin denegaciones individuales.
- API key secreta o publicable.
- Proceso interno / error de configuración.

## 3. Hallazgos

Cada hallazgo indica si fue **reproducido** o solo **revisado estáticamente**. Los identificadores se usan en `docs/43`.

### TH-01 · Wildcard ignoraba denegaciones individuales

- **Severidad:** Alta.
- **Archivo:** `src/lib/jovy/authz/middleware.ts`, `permissions.ts`, `api/admin/jovy/authz/me/route.ts`, `navigation.ts`, rutas de accesos.
- **Condición:** usuario con `allow *:*` y `deny medusa_users:manage_settings`. El snapshot marcaba `wildcard: true` y las rutas nativas no clasificadas se permitían; `/authz/me` anunciaba permisos anulados.
- **Impacto:** escalamiento efectivo sobre operaciones denegadas y decisiones de UI incorrectas.
- **Evidencia:** prueba HTTP `anula el wildcard del Superadministrador con una denegación individual`; unidad `permissions.test.ts` y `route-policy.test.ts`.
- **Corrección:** `isGlobalAdmin(allow, deny)` exige `*:*` **y** `deny.size === 0`; snapshot y `/me` usan `effectivePermissionKeys`; UI consume permisos efectivos.
- **Regresión:** TH-01 en `docs/43`.

### TH-02 · Excepciones del shell evaluadas antes de la identidad

- **Severidad:** Alta.
- **Archivo:** `src/lib/jovy/authz/middleware.ts`, `route-policy.ts`.
- **Condición:** `isShellRead()` se ejecutaba antes de comprobar `actor_type`; `/admin/stores*` era una familia completa y `feature-flags*` un prefijo.
- **Impacto:** una petición sin sesión o con actor distinto de `user` podía saltarse el guard y depender solo de la ruta nativa; superficie innecesariamente amplia.
- **Evidencia:** prueba HTTP `exige sesión para las lecturas del shell y limita /admin/stores` (401 anónimo, 200 con sesión, 403 en mutación).
- **Corrección:** solo `GET/HEAD /admin/feature-flags` es público; el resto se evalúa después de validar sesión y usuario. `/admin/stores` se limita a listado y detalle `GET`; las mutaciones exigen `medusa_settings:manage_settings`.
- **Regresión:** TH-02.

### TH-03 · Bootstrap automático por correo

- **Severidad:** Alta.
- **Archivo:** `src/modules/jovy-authz/service.ts` (retirado), `src/lib/jovy/authz/middleware.ts` (retirado), `integration-tests/setup.js`.
- **Condición:** `JOVY_AUTHZ_BOOTSTRAP_EMAILS` concedía `superadmin` al resolver permisos de una petición normal; una variable reintroducida reactivaba privilegios sin auditoría operativa.
- **Impacto:** elevación silenciosa y persistente; dependencia de una variable ambiental.
- **Corrección:** función eliminada. Nuevo comando `src/scripts/bootstrap-authz.ts`, con `--user-id`, modo `bootstrap|recovery`, confirmación explícita para recuperación, auditoría e idempotencia. Segundo bootstrap rechazado. Retirar el último Superadministrador bloqueado.
- **Regresión:** pruebas de módulo de bootstrap y recuperación; TH-03.

### TH-04 · Sustituciones de permisos sin transacción

- **Severidad:** Alta.
- **Archivo:** `src/modules/jovy-authz/service.ts`.
- **Condición:** `replaceRolePolicies` y `replaceUserAccess` borraban y recreaban en operaciones separadas; un fallo intermedio dejaba al usuario sin roles o con políticas parciales y la auditoría no reflejaba el estado real.
- **Impacto:** denegación o concesión parcial, pérdida silenciosa de acceso, auditoría engañosa.
- **Corrección:** patrón oficial `@InjectManager` + `@InjectTransactionManager` + `@MedusaContext`; rol, políticas, asignaciones y auditoría comparten transacción.
- **Prueba:** suite de módulos (fallo de política inválida no deja escritura); concurrencia no ejecutada contra dos instancias.
- **Regresión:** TH-04.

### TH-05 · Resolución de permisos escribía roles en cada miss de caché

- **Severidad:** Media.
- **Archivo:** `service.ts`, `middleware.ts`, rutas GET de accesos.
- **Condición:** `ensureSystemRoles()` se ejecutaba al resolver permisos y en `listRolesWithPolicies`; cada caché miss podía escribir e invalidar la caché global.
- **Impacto:** efectos secundarios en lecturas, contención y comportamiento impredecible en concurrencia.
- **Corrección:** la siembra solo ocurre en el comando de bootstrap y en pruebas. Las lecturas son puras.
- **Regresión:** TH-05.

### TH-06 · Usuario eliminado conservaba snapshot en caché

- **Severidad:** Media.
- **Archivo:** `middleware.ts`, `cache.ts`.
- **Condición:** el snapshot se leía antes de comprobar la existencia del usuario; durante 15 s un usuario eliminado podía seguir pasando el guard.
- **Impacto:** ventana de acceso tras eliminación.
- **Corrección:** `assertUserExists` se ejecuta en cada petición, fuera de la caché. La caché solo contiene permisos ya resueltos.
- **Regresión:** prueba de revocación y revisión de caché.

### TH-07 · Rutas ambiguas podían clasificarse con un prefijo distinto

- **Severidad:** Media.
- **Archivo:** `route-policy.ts`, `middleware.ts`.
- **Condición:** `/admin/products/../users`, separadores codificados o barras invertidas podían coincidir con el prefijo autorizado de otro recurso antes de que el router resolviera la ruta.
- **Impacto:** decisión de autorización sobre una ruta distinta de la ejecutada.
- **Corrección:** `isAmbiguousPath` rechaza segmentos `.`/`..`, `\`, `%2e`, `%2f` y `%5c`; no se normaliza por cuenta propia.
- **Regresión:** unidad `route-policy.test.ts`; TH-07.

### TH-08 · Caché por proceso sin invalidación distribuida

- **Severidad:** Media.
- **Archivo:** `src/lib/jovy/authz/cache.ts`.
- **Condición:** dos instancias; una cambia roles y la otra conserva el snapshot hasta 15 s.
- **Impacto:** revocación no inmediata entre instancias.
- **Estado:** **PENDIENTE / BLOQUEADO** por no disponer de entorno multiinstancia ni Redis operativo. Se documenta la ventana máxima y la ausencia de fallback permisivo.
- **Mitigación:** TTL 15 s, invalidación local inmediata, denegación por defecto ante error de resolución.

### TH-09 · Cobertura nativa por prefijo, no RBAC oficial

- **Severidad:** Media.
- **Archivo:** `route-policy.ts` (`NATIVE_AREAS`).
- **Condición:** una ruta nueva de Medusa no clasificada queda denegada para usuarios restringidos; una actualización puede requerir mantenimiento.
- **Impacto:** denegación legítima (fail-closed), no apertura. Riesgo de que un `POST` sensible comparta un permiso de área.
- **Estado:** **RIESGO ACEPTADO FORMALMENTE** para el alcance actual; cubierto por prueba de inventario y denegación por defecto. La granularidad fina (reembolsos, cancelaciones) queda **PENDIENTE**.

### TH-10 · Sidebar nativo visible sin RBAC Enterprise

- **Severidad:** Media (UX/control visual, no bypass de API).
- **Archivo:** dashboard compilado de `@medusajs/dashboard`.
- **Condición:** un operador restringido ve entradas nativas, pero recibe 403 al abrirlas.
- **Impacto:** no hay divulgación de datos por la API; sí se incumple el requisito de navegación integral.
- **Estado:** **BLOQUEADO POR LICENCIA**. Opciones y comparación en `docs/40`. No se usa CSS ni parche de `node_modules`.

### TH-11 · API keys secretas

- **Severidad:** Alta si se aceptan como actor administrativo.
- **Archivo:** `middleware.ts`.
- **Condición:** `x-medusa-access-token`.
- **Estado:** el guard exige `actor_type === "user"`; las claves secretas reciben **401** en rutas Jovy y nativas (probado).
- **Riesgo residual:** una clave usada por un proceso interno no debe heredar privilegios humanos; no hay cuentas de servicio diseñadas.

### TH-12 · Exportaciones y PII

- **Severidad:** Alta.
- **Archivo:** rutas de contactos y `src/lib/jovy/contacts.ts`.
- **Condición:** rol con `read` intenta exportar; consulta cruzada de bandeja; consolidado sin todas las bandejas.
- **Estado:** `export` es operación separada; middleware y handler resuelven el tipo real; export consolidado exige todas las bandejas seleccionadas. Probado en HTTP.
- **Riesgo residual:** no hay filtrado por campo; un rol con `read` de una bandeja recibe la PII completa de esa bandeja. **PENDIENTE** si el negocio exige minimización.

### TH-13 · Errores del subsistema de autorización

- **Severidad:** Alta.
- **Archivo:** `middleware.ts`.
- **Condición:** fallo de base de datos, caché corrupta o error inesperado al resolver permisos.
- **Estado:** el guard deniega (401/403) y no concede permisos por defecto. No hay fallback a `allow`.
- **Prueba:** revisión de ruta de error y prueba de usuario inexistente.

### TH-14 · Configuración de sesión/HTTPS

- **Severidad:** Alta para producción.
- **Archivo:** `medusa-config.ts`, variables `ADMIN_ALLOW_HTTP`, CORS.
- **Condición:** cookie no `Secure`, CORS amplio o terminación TLS mal configurada.
- **Estado:** `secure` depende de `NODE_ENV=production` y `ADMIN_ALLOW_HTTP`; no se validó HTTPS real, proxy ni cookies en staging. **PENDIENTE / BLOQUEADO** por ausencia de entorno. Ver `docs/44`.

## 4. Riesgos descartados con evidencia

| Hipótesis | Resultado |
|---|---|
| Bypass por `OPTIONS`/`HEAD` | `HEAD` se trata como lectura; `OPTIONS` no está clasificado y se deniega a restringidos. Sin bypass observado. |
| Bypass por barra final | Se normaliza y se prueba; no amplía permisos. |
| Bypass por mayúsculas | Express puede enrutar distinto; el guard deniega al no coincidir el prefijo. Fail-closed. |
| Autoasignación de roles | Bloqueada por comparación de actor y objetivo (403) y probada. |
| Delegación de privilegios | Se comparan políticas del rol y del body con permisos efectivos del actor; probado. |
| API key hereda admin | Rechazada con 401 en Jovy y nativa. |
| Ruta no clasificada abierta | Denegada para no wildcard; probado. |
| Sesión revocada conserva acceso | La asignación se invalida en el proceso; la siguiente petición recibe 403. |
| Error de permisos concede acceso | No; denegación por defecto. |
| Auditoría registra secretos | Metadata limitada a códigos y claves de permiso; no se registran tokens ni PII. |

## 5. Fuera de alcance / no probado

- Pentest externo, fuzzing de red y pruebas de carga.
- HTTPS real, proxy inverso, cookies en navegador real y CSRF.
- Backup/restore de PostgreSQL y recuperación ante desastre.
- Múltiples instancias y Redis.
- Filtrado de campos por rol y cuentas de servicio.
- Sidebar nativo filtrado (bloqueado por licencia).

Estas exclusiones impiden un dictamen GO; ver `docs/44`.
