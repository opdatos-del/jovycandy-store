# Seguridad de endpoints del CMS

**Corte:** 2026-11-20  
**Inventario en código:** `apps/backend/src/lib/jovy/authz/route-policy.ts`.  
**Cobertura:** 60 archivos `route.ts`, 101 métodos (`GET` 46, `POST` 24, `PUT` 19, `DELETE` 12).

## 1. Regla general

1. `authenticate` global del loader de Medusa valida la sesión/JWT.
2. `authorizeJovyAdmin` resuelve los permisos efectivos y rechaza actores que no sean `user`.
3. `/admin/jovy/**` exige una regla del inventario; sin regla ⇒ **403**.
4. `/admin/**` nativo se clasifica por prefijo; sin permiso o sin clasificación ⇒ **403**.
5. Superadministrador (`*:*`) conserva acceso global.
6. Las API keys secretas no se aceptan en el Admin: **401**.

Respuestas:

- **401:** no hay sesión válida.
- **403:** actor autenticado sin permiso o ruta no clasificada.
- **404:** contacto de otra bandeja (para no revelar su existencia).

## 2. Inventario Jovy por recurso

| Recurso | Rutas principales | Operaciones exigidas |
|---|---|---|
| Dashboard | `GET /admin/jovy/dashboard` | read |
| Catálogo | `categories` GET, `categories/:id`, `families`, `reorder`, `seed` | read, update, create, delete |
| Lanzamientos | `/launches`, `/:id`, `reorder`, `settings` | read, create, update, delete, manage_settings |
| Galería | `/brand/gallery`, `/:id`, `audit`, `reorder` | read, create, update, delete, publish, archive |
| Logos | `/brand/logos`, `/:id`, `audit`, `reorder`, `media` | read, create, update, delete |
| Anuncios | `/marketing/banners`, `/announcements/settings` | read, create, update, delete, publish, archive, manage_settings |
| Eventos | `/events`, `/:id`, `audit`, `types`, `reorder`, `media/video` | read, create, update, delete, publish, archive |
| Marketing | `/marketing/hero`, `/:id`, `product`, `reorder`, `settings`, `products`, `media` | read, create, update, delete, publish, archive, manage_settings |
| Contenido | `/content/pages`, `/:id`, `audit` | read, create, update, delete, publish, archive |
| Ficha editorial | `/products/editorial`, `/products/:id/editorial`, `restore` | read, update, delete, restore, publish, archive |
| Accesos | `/authz/me`, `catalog`, `roles`, `roles/:id`, `policies`, `users`, `users/:id` | authenticated, read, manage_settings |
| Contactos | ver sección 3 | read, update, delete, restore, export |

La prueba unitaria `inventory.test.ts` falla si:

- un método exportado por un `route.ts` no tiene regla;
- una regla no corresponde a un archivo/método real;
- una regla declara una operación que el catálogo no ofrece.

## 3. Aislamiento de contactos

| Endpoint | Regla |
|---|---|
| `GET /contacts?contact_type=X` | exige read de X |
| `GET /contacts` sin tipo | exige read de las cuatro bandejas |
| `GET /contacts/counts` | exige read de las cuatro |
| `GET /contacts/export?contact_type=X` | exige export de X |
| `GET /contacts/export-all` | exige export de cada bandeja seleccionada; sin `contact_types`, de las cuatro |
| `GET /contacts/:id` | lee la fila y exige read de su tipo; si no, 404 |
| `PUT /contacts/:id` | exige update de su tipo; si no, 404 |
| `DELETE /contacts/:id` | exige delete de su tipo; si no, 404 |
| `GET /contacts/:id/audit` | exige read de su tipo; si no, 404 |
| `POST /contacts/:id/restore` | exige restore de su tipo; si no, 404 |

La comprobación se ejecuta en middleware **y** en el handler. Cambiar `contact_type`, `contact_types`, el ID o los filtros no amplía el alcance. Se conservan `Cache-Control: no-store`, tope de filas, auditoría sin PII y protección anti-fórmulas.

## 4. Superficies nativas

| Prefijo | Recurso | POST/PUT/DELETE |
|---|---|---|
| `/admin/products*`, `product-*`, `uploads` | `medusa_products` | create/update/delete |
| `/admin/orders`, `draft-orders`, `returns`, `claims`, `exchanges`, `fulfillments`, `refunds`, `payments` | `medusa_orders` | update/delete |
| `/admin/customers*` | `medusa_customers` | create/update/delete |
| `/admin/inventory-items`, `stock-locations`, `reservations` | `medusa_inventory` | create/update/delete |
| `/admin/price-lists`, `prices`, `price-preferences` | `medusa_prices` | create/update/delete |
| `/admin/promotions`, `campaigns` | `medusa_promotions` | create/update/delete |
| `/admin/users`, `invites` | `medusa_users` | manage_settings |
| `/admin/api-keys` | `medusa_api_keys` | manage_settings |
| `/admin/stores`, regiones, monedas, impuestos, envíos, canales | `medusa_settings` | manage_settings |

Lecturas mínimas del shell, divididas por nivel de confianza:

| Ruta | Sesión | Motivo |
|---|---|---|
| `GET /admin/feature-flags` | No | El dashboard la consulta antes de tener sesión útil; no devuelve datos de negocio |
| `GET /admin/users/me` | Sí | Perfil propio |
| `GET /admin/notifications*` | Sí | Notificaciones del propio usuario |
| `GET /admin/layouts*` | Sí | Preferencias del shell |
| `GET /admin/modules*` | Sí | Inventario de extensiones del dashboard |
| `GET /admin/translations*` | Sí | Traducciones del dashboard |
| `GET /admin/stores` y `GET /admin/stores/:id` | Sí | El shell carga la tienda; solo lectura |

Reglas:

- Toda excepción que no sea `feature-flags` se evalúa **después** de validar
  `actor_type === "user"` y de comprobar que el usuario existe.
- `/admin/stores` solo permite `GET` de listado y detalle; cualquier mutación exige
  `medusa_settings:manage_settings`.
- Una ruta con segmentos `.`/`..`, barras invertidas o separadores codificados se
  rechaza (`isAmbiguousPath`) en lugar de normalizarse.

Cualquier otra ruta nativa no clasificada se deniega salvo para un wildcard sin
denegaciones (`isGlobalAdmin`).

## 5. Bootstrap y recuperación

- No existe bootstrap por variable de entorno ni elevación durante una petición.
- La instalación se inicializa con un comando operativo explícito:

  ```powershell
  pnpm --dir apps/backend exec medusa exec ./src/scripts/bootstrap-authz.ts -- --user-id=usr_...
  ```

- El comando siembra los roles ausentes y asigna `superadmin` en una transacción
  con auditoría (`action = bootstrap`). Se rechaza si ya existe un
  Superadministrador.
- La recuperación exige `--mode=recovery --confirm=recover-superadmin` y queda
  auditada con el modo. No hay puerta trasera permanente ni correo privilegiado.
- Reejecutar el comando para el mismo usuario devuelve `already` sin escribir.
- Retirar el último `superadmin` está bloqueado por el servicio.

## 6. Lo que no cubre

- No valida políticas oficiales de Medusa porque el módulo Enterprise no está instalado.
- No oculta la navegación nativa del shell; la API sí la deniega.
- No protege rutas nuevas de Medusa hasta que se añadan a `NATIVE_AREAS`.
- No sustituye una revisión de seguridad ni un pentest.
