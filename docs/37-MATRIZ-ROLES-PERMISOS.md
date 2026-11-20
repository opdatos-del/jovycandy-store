# Matriz de roles y permisos

**Corte:** 2026-11-20  
**Fuente de verdad en código:** `apps/backend/src/lib/jovy/authz/catalog.ts` y `route-policy.ts`.

## 1. Operaciones

| Operación | Uso |
|---|---|
| `read` | Consultar listados, detalle, auditoría y configuración legible |
| `create` | Crear registros y ejecutar seeds |
| `update` | Modificar registros, orden y activación |
| `delete` | Eliminar o enviar a papelera |
| `publish` | Publicar y despublicar |
| `archive` | Archivar |
| `restore` | Restaurar registros eliminados |
| `export` | Descargar CSV/XLSX |
| `manage_settings` | Configuración sensible |

`read` no implica `export`; `update` no implica `delete/publish/archive`; `publish` se exige además de `update` cuando el cuerpo cambia el estado a `published`; `archive` se exige para `archived`.

## 2. Recursos

### CMS

| Recurso | Operaciones |
|---|---|
| `jovy_dashboard` | read |
| `jovy_catalogue` | read, create, update, delete, manage_settings |
| `jovy_launches` | read, create, update, delete, manage_settings |
| `jovy_gallery` | read, create, update, delete, publish, archive |
| `jovy_logos` | read, create, update, delete |
| `jovy_announcements` | read, create, update, delete, publish, archive, manage_settings |
| `jovy_events` | read, create, update, delete, publish, archive |
| `jovy_marketing` | read, create, update, delete, publish, archive, manage_settings |
| `jovy_content` | read, create, update, delete, publish, archive |
| `jovy_product_editorial` | read, update, delete, restore, publish, archive |

Novedades comparte el recurso `jovy_events`: es una vista de la misma tabla y no un almacén separado.

### Contactos

| Recurso | Bandeja |
|---|---|
| `jovy_contacts_national` | Ventas Nacionales |
| `jovy_contacts_international` | Ventas Internacionales |
| `jovy_contacts_customer_service` | Atención al Cliente |
| `jovy_contacts_catalogue` | Solicitudes de Catálogo |

Operaciones por bandeja: `read`, `update`, `delete`, `restore`, `export`.

### Accesos y superficies nativas

| Recurso | Uso |
|---|---|
| `jovy_access` | Roles, políticas y asignaciones |
| `medusa_products` | Productos, variantes, categorías, tags, colecciones y uploads |
| `medusa_orders` | Pedidos, borradores, devoluciones, reclamos, cambios, pagos y cumplimiento |
| `medusa_customers` | Clientes y grupos |
| `medusa_inventory` | Inventario, ubicaciones y reservas |
| `medusa_prices` | Listas de precios y preferencias |
| `medusa_promotions` | Promociones y campañas |
| `medusa_sales_channels` | Canales de venta usados por productos y pedidos |
| `medusa_users` | Usuarios e invitaciones |
| `medusa_api_keys` | API keys |
| `medusa_settings` | Tiendas, regiones, monedas, impuestos, envíos y canales |

## 3. Roles semilla

`ensureSystemRoles` crea los ausentes y **no sobrescribe** políticas ajustadas.

| Código | Nombre | Políticas resumidas |
|---|---|---|
| `superadmin` | Superadministrador | `*:*` |
| `cms_admin` | Administrador CMS | Todo el CMS, incluida configuración; sin contactos ni nativos |
| `cms_editor` | Editor CMS | read/create/update/publish/archive del CMS |
| `cms_viewer` | Consulta CMS | read del CMS |
| `product_manager` | Gestor de Productos | Productos, precios e inventario nativos; canales de venta read; ficha editorial y catálogo read/update |
| `product_viewer` | Consulta de Productos | Productos, precios, inventario y canales de venta read; ficha/catálogo read |
| `sales_national_sales` | Ventas Nacionales | read/update/export de su bandeja |
| `sales_international_sales` | Ventas Internacionales | read/update/export de su bandeja |
| `sales_customer_service` | Atención al Cliente | read/update/export de su bandeja |
| `sales_catalogue` | Solicitudes de Catálogo | read/update/export de su bandeja |

No se asigna `delete` ni `restore` de contactos a los roles de ventas por defecto; se pueden añadir con una política explícita.

## 4. Permisos efectivos

1. Se unen las políticas de todos los roles asignados.
2. Se aplican las excepciones individuales.
3. `deny` gana sobre cualquier `allow`, incluso `*:*`.
4. Sin asignación ni bootstrap ⇒ sin permisos.
5. Un rol con `jovy_access:manage_settings` puede delegar solo políticas que él mismo posee y nunca el rol `superadmin` si no es global.
6. Ningún usuario puede modificar sus propios accesos.

## 5. Ejemplos verificados

| Escenario | Resultado |
|---|---|
| Consulta CMS + Ventas Nacionales + Consulta Productos | Lee CMS, atiende/exporta su bandeja nacional y lee productos; no modifica productos, no ve otras bandejas, no administra accesos |
| Ventas Nacionales consulta `contact_type=international-sales` | 403 |
| Ventas Nacionales consulta una solicitud internacional por ID | 404 |
| Rol con `read` intenta exportar | 403 |
| Rol con `update` intenta publicar contenido | 403 |
| Rol con un solo rol de ventas descarga el consolidado | 403 |
| Rol con dos bandejas exporta solo esas dos | 200 |
| Consulta de productos llama `/admin/users` | 403 |
| API key secreta llama `/admin/jovy/**` | 401 |
| Usuario sin roles llama cualquier API Jovy | 403 |

## 6. Estado

- Diseño de recursos/operaciones: **IMPLEMENTADO**.
- Roles persistentes y asignaciones: **IMPLEMENTADO**.
- Aplicación backend: **PROBADA** por integración HTTP.
- UI de accesos: **IMPLEMENTADA** como catálogo global dentro de `Settings → Accesos y permisos`; la asignación por persona vive en el widget `user.details` del detalle nativo de Usuarios.
- Navegación calculada: **IMPLEMENTADA** por endpoint y catálogo; el sidebar nativo sin filtrado sigue **BLOQUEADO POR LICENCIA**.
- Auditoría de cambios: **IMPLEMENTADA** sobre `jovy_authz_audit_log`.
- Gating visual: **IMPLEMENTADO** en Contactos, Lanzamientos, Galería, Catálogo, Logos, Contenido, Eventos, Anuncios, Marketing, Novedades y ficha editorial.
- RBAC Enterprise: **BLOQUEADO POR LICENCIA**.
