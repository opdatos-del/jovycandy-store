# Implementación y pruebas de autorización

**Corte:** 2026-11-20  
**Mecanismo:** autorización propia sobre la identidad nativa de Medusa (ver `docs/36`).  
**Estado global:** `IMPLEMENTADO` y `PROBADO` en backend; UI parcialmente cubierta; RBAC Enterprise `BLOQUEADO POR LICENCIA`.

## 1. Archivos

### Módulo y datos

- `src/modules/jovy-authz/` — modelos `role`, `policy`, `assignment`, `user-policy`, `audit-log`; servicio; migraciones `Migration20261120100000` y `Migration20261120110000`.
- `medusa-config.ts` — módulo registrado como `./src/modules/jovy-authz`.

### Autorización

- `src/lib/jovy/authz/catalog.ts` — recursos, operaciones y roles semilla.
- `src/lib/jovy/authz/permissions.ts` — claves, comodines, deny y recursos de contactos.
- `src/lib/jovy/authz/route-policy.ts` — inventario de 101 métodos, reglas de contactos, mapa nativo y shell.
- `src/lib/jovy/authz/middleware.ts` — resolución de identidad, caché de 15 s, bootstrap y decisión.
- `src/lib/jovy/authz/contacts.ts` — validación por bandeja para middleware y handlers.
- `src/lib/jovy/authz/cache.ts` — caché por usuario con invalidación.
- `src/lib/jovy/authz/navigation.ts` — catálogo de grupos/opciones y filtrado por permisos.
- `src/modules/jovy-authz/models/audit-log.ts` + `Migration20261120110000` — auditoría de cambios.
- `src/lib/jovy/authz/http.ts`, `schemas.ts` — errores y validación de la API de accesos.
- `src/api/middlewares.ts` — `authorizeJovyAdmin` sobre `/admin/*`; la autenticación la aporta el loader nativo y el guard rechaza actores que no sean `user`.

### API de accesos

- `GET /admin/jovy/authz/me`
- `GET /admin/jovy/authz/navigation`
- `GET /admin/jovy/authz/catalog`
- `GET /admin/jovy/authz/audit`
- `GET/POST /admin/jovy/authz/roles`
- `GET/PUT/DELETE /admin/jovy/authz/roles/:id`
- `PUT /admin/jovy/authz/roles/:id/policies`
- `GET /admin/jovy/authz/users`
- `GET/PUT /admin/jovy/authz/users/:id`

### Contactos

Modificados listado, conteos, exportación individual, exportación consolidada, detalle, edición, eliminación, auditoría y restauración.

### UI

- `src/admin/features/access/` — pantalla de roles, matriz de permisos y asignación de usuarios.
- `src/admin/routes/settings/access/page.tsx` — catálogo global de roles dentro de Settings.
- `src/admin/widgets/user-access.tsx` — asignación por usuario en el detalle nativo `Settings → Users` (`zone: "user.details"`).
- `src/admin/widgets/user-access-link.tsx` — enlace de descubrimiento en la lista nativa `Settings → Users` (`zone: "user.list"`).
- `src/admin/shared/hooks/use-jovy-permissions.ts` y `permission-gate.tsx`.
- Gating aplicado en Contactos, Lanzamientos, Galería, Catálogo, Logos, Contenido, Eventos, Anuncios, Marketing y ficha editorial.

## 2. Activación segura

1. **Inventario de usuarios**: revisar administradores existentes.
2. **Respaldo**: snapshot recuperable de PostgreSQL.
3. **Entorno aislado**: aplicar primero en una copia.
4. **Migración**: `pnpm --dir apps/backend exec medusa db:migrate` crea solo las cinco tablas `jovy_authz_*` (incluida auditoría).
5. **Bootstrap**: ejecutar el comando explícito con el ID del administrador legítimo
   (no se usa correo como privilegio):

   ```powershell
   pnpm --dir apps/backend exec medusa exec ./src/scripts/bootstrap-authz.ts -- --user-id=usr_...
   ```

   Si ya existe un Superadministrador, el comando se rechaza. Para recuperar el
   último acceso: `--mode=recovery --confirm=recover-superadmin`.
6. **Arranque**: iniciar el servidor y abrir `Settings → Accesos y permisos` para el catálogo de roles.
7. **Asignación persistente**: el comando deja la asignación `superadmin` y una entrada
   `bootstrap` en `jovy_authz_audit_log`.
8. **Sin bootstrap ambiental**: `JOVY_AUTHZ_BOOTSTRAP_EMAILS` ya no existe en el código.
9. **Verificar**: `/admin/jovy/authz/me` debe devolver roles y permisos; una cuenta restringida debe recibir 403.
10. **Reversión**: restaurar el respaldo o ejecutar el `down` de la migración; retirar el registro del módulo.

La migración `db:migrate` imprimió los *migration scripts* de RBAC de Medusa. **No se creó ninguna tabla `rbac_*`** porque el módulo Enterprise no está registrado; no se modificaron usuarios ni roles oficiales.

## 3. Matriz de pruebas automáticas

### Unitarias (`test:unit`)

- `inventory.test.ts`: todos los métodos de los 60 `route.ts` tienen regla; no hay reglas fantasma; las operaciones existen en el catálogo; cada área nativa referencia un recurso real.
- `permissions.test.ts`: unión, operaciones separadas, deny, comodines, precedencia `deny` sobre `*:*` y expansión de permisos efectivos.
- `route-policy.test.ts`: aislamiento por bandeja, export separado, consolidado, publicación/archivo, superficies nativas, shell público vs. autenticado, rutas ambiguas, `HEAD`, barra final y deny por defecto.
- `cache.test.ts`: TTL, expiración e invalidación por usuario y global.
- Contactos: pruebas existentes ajustadas con un actor autorizado explícito.

### Integración de módulos

`authz.integration.test.ts`:

- siembra idempotente de roles;
- unión de roles;
- deny individual;
- revocación al reasignar;
- protección de roles del sistema/asignados;
- validación de políticas;
- bootstrap explícito, idempotencia, rechazo del segundo bootstrap y recuperación;
- bloqueo al retirar el último Superadministrador;
- `deny` anula `*:*` en permisos efectivos.

### Integración HTTP

`integration-tests/http/authz.spec.ts`, 17 escenarios:

| Escenario | Resultado |
|---|---|
| Sin sesión | 401 |
| Usuario sin roles | 403 |
| Solo lectura de dashboard | 200 en GET, 403 en contactos/roles |
| Ventas Nacionales consulta Internacionales | 403 |
| Ventas Nacionales consulta por ID ajeno | 404 |
| Ventas Nacionales actualiza su solicitud | 200 |
| Rol sin export intenta CSV | 403 |
| Dos bandejas y consolidado de dos | 200 |
| Consolidado de las cuatro con dos roles | 403 |
| Consulta de productos: GET nativo 200, POST 403, usuarios 403, shell 200 | Correcto |
| Acceso de lectura a roles no permite escribir políticas | 403 |
| Autoedición de accesos | 403 |
| Delegación de un rol con permisos superiores | 403 |
| Navegación de Ventas Nacionales | Solo su bandeja |
| Navegación de Consulta de Productos | Solo grupo Medusa |
| Auditoría de cambios | 200, sin secretos |
| `update` sin `publish` | 403 |
| API key secreta en API Jovy y nativa | 401 |
| Shell sin sesión / `feature-flags` público | 401 / 200 |
| `*:*` + `deny` | 403 en la operación denegada; `/me` sin el permiso |
| Revocación al retirar roles | 403 en la siguiente petición |

## 4. Regresión

| Check | Resultado |
|---|---|
| typecheck | 0 errores |
| lint | 0 errores; 2 warnings preexistentes |
| unit | 39 suites / 376 pruebas |
| integración módulos | 7 suites / 47 pruebas |
| integración HTTP | 12 suites / 93 pruebas |
| build | backend y Admin correctos |
| E2E | 31/31 |

## 5. Cobertura de UI

| Pantalla | Gating |
|---|---|
| Contactos | Acciones por fila, detalle, notas, papelera, restore y exportación |
| Lanzamientos | Crear, editar, activar, ordenar, eliminar y color global |
| Galería | Carga, editar, publicar, archivar, activar, ordenar y eliminar |
| Catálogo | Seed, editar, Próximamente y orden |
| Logos | Crear, editar, activar, ordenar y eliminar |
| Contenido | Crear, editar, eliminar y formulario |
| Eventos | Crear, editar, publicar, archivar, ordenar, eliminar y tipos |
| Anuncios | Crear, editar, publicar, archivar y eliminar |
| Marketing | Crear, editar, publicar, archivar, eliminar y color global |
| Ficha editorial | Guardar, publicar, archivar, restaurar y eliminar |
| Accesos | Pantalla global de roles y políticas |
| Usuarios nativos | Widget `user.details` para asignar roles dentro del detalle de Settings → Users |
| Configuración → Accesos | Catálogo de roles, matriz, usuarios y auditoría en `/app/settings/access` |
| Novedades | Crear, editar, publicar, archivar, ordenar, multimedia y eliminar |

## 6. Pruebas de navegador

La pantalla de accesos incluye búsqueda de roles y usuarios, presets **Solo lectura / Todo / Limpiar**,
búsqueda de recursos, contador de permisos, estado de cambios sin guardar, descarte, chips para quitar
roles y confirmación al dejar un usuario sin roles.

Validación visual con el build de producción en `localhost:9000`:

- Accesos y permisos: 1440 × 1000 en oscuro y 375 × 812 en claro; sin overflow
  (`scrollWidth === innerWidth`) y sin errores de consola.
- Detalle nativo `Settings → Users → usuario`: el widget «Accesos Jovy» aparece dentro de la ficha
  nativa. Para el propio usuario muestra los roles en solo lectura; para otro usuario permite
  editarlos y guardarlos.
- La matriz muestra roles, recursos y operaciones; la tabla de usuarios y el editor responden.
- Las pantallas migradas conservan testids, cabeceras y acciones para el Superadministrador.
- La suite E2E se ejecutó completa: 31/31, incluida la navegación a Accesos y permisos.
- No se usaron datos personales reales. Las cuentas restringidas se prueban por integración HTTP;
  no se creó un fixture de usuarios DEMO navegable.

## 7. Limitaciones y pendientes

- RBAC Enterprise no licenciado.
- Navegación nativa del shell no filtrada; API sí.
- Cobertura nativa por prefijo, revisable tras actualizar Medusa.
- Excepciones individuales allow/deny: soportadas por API (`PUT /authz/users/:id`) y resolución de permisos; la pantalla de accesos asigna roles, no edita todavía las excepciones.
- Pruebas E2E multirol pendientes; requieren un fixture de usuarios DEMO aislado.
- Caché de permisos de 15 s por proceso.
- Bootstrap debe retirarse tras la asignación persistente.

## 8. Criterios de aceptación

| Criterio | Estado |
|---|---|
| Usuarios nativos con roles reales | IMPLEMENTADO |
| Políticas persistentes | IMPLEMENTADO |
| Permisos ajustables individualmente | Políticas por rol en UI; excepciones allow/deny por API |
| Roles múltiples | IMPLEMENTADO Y PROBADO |
| Backend aplica permisos | PROBADO |
| Rutas Jovy protegidas | PROBADO |
| Superficies comerciales nativas | IMPLEMENTADO con cobertura por prefijo; PROBADO en productos/usuarios/API keys |
| Bandejas aisladas | PROBADO |
| Exportación separada | PROBADO |
| Solo lectura sin mutaciones | PROBADO |
| UI coherente | IMPLEMENTADO en todas las features migradas |
| Pruebas negativas | PROBADO |
| Sin escalamiento evidente | Autodelegación bloqueada; subconjunto de permisos; API keys fuera |
| Regresión global | En curso |
