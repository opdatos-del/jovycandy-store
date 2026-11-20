# Navegación dinámica y permisos en Medusa

**Corte:** 2026-11-20  
**Estado:** catálogo y filtrado de navegación **IMPLEMENTADOS**; ocultamiento del sidebar nativo **BLOQUEADO POR LICENCIA**.

## 1. Hechos verificados

- Medusa 2.22.6 incluye `defineRouteConfig({ permissions })` y el dashboard evalúa esas
  políticas con `usePermittedNavItems`.
- `permissions` solo se aplica cuando el módulo RBAC Enterprise está instalado. Sin licencia,
  `usePermissions` no restringe y todas las entradas siguen visibles.
- El sidebar nativo combina rutas core con extensiones; las rutas core usan hooks de permisos
  nativos y las extensiones usan `permissions`. No hay un slot público para que una extensión
  sustituya el sidebar completo.
- El issue [#15945](https://github.com/medusajs/medusa/issues/15945) fue cerrado por el PR
  #15620, que añadió `permissions` y el filtrado de entradas de extensión **con RBAC activo**.
- No se modificó `node_modules`, no se parcheó el dashboard y no se ocultó nada con CSS.

## 2. Modelo de tres niveles

1. **Autorización efectiva:** `jovy-authz` resuelve recursos/operaciones del actor.
2. **Acceso a funciones:** middleware y handlers deciden si la petición se ejecuta.
3. **Navegación visible:** `GET /admin/jovy/authz/navigation` devuelve solo grupos/opciones
   permitidos. La UI no inventa permisos.

La navegación se deriva de la autorización; no al revés.

## 3. Inventario de grupos y opciones

### Medusa nativo

| Grupo | Opción | Ruta | Permiso mínimo |
|---|---|---|---|
| Medusa | Pedidos | `/app/orders` | `medusa_orders:read` |
| Medusa | Productos | `/app/products` | `medusa_products:read` |
| Medusa | Colecciones | `/app/collections` | `medusa_products:read` |
| Medusa | Categorías | `/app/categories` | `medusa_products:read` |
| Medusa | Opciones de producto | `/app/product-options` | `medusa_products:read` |
| Medusa | Inventario | `/app/inventory` | `medusa_inventory:read` |
| Medusa | Reservas | `/app/reservations` | `medusa_inventory:read` |
| Medusa | Clientes | `/app/customers` | `medusa_customers:read` |
| Medusa | Grupos de clientes | `/app/customer-groups` | `medusa_customers:read` |
| Medusa | Promociones | `/app/promotions` | `medusa_promotions:read` |
| Medusa | Campañas | `/app/campaigns` | `medusa_promotions:read` |
| Medusa | Listas de precios | `/app/price-lists` | `medusa_prices:read` |

### Settings

| Opción | Ruta | Permiso mínimo |
|---|---|---|
| Usuarios | `/app/settings/users` | `medusa_users:read` |
| Accesos y permisos | `/app/settings/access` | `jovy_access:read` |
| Tienda | `/app/settings/store` | `medusa_settings:read` |
| Regiones | `/app/settings/regions` | `medusa_settings:read` |
| Monedas | `/app/settings/currencies` | `medusa_settings:read` |
| Impuestos | `/app/settings/taxes` | `medusa_settings:read` |
| Envíos | `/app/settings/shipping` | `medusa_settings:read` |
| Pagos | `/app/settings/payments` | `medusa_settings:read` |
| API keys | `/app/settings/api-keys` | `medusa_api_keys:manage_settings` |

### JovyCandy CMS

| Opción | Ruta | Permiso |
|---|---|---|
| Dashboard | `/app/jovy/dashboard` | `jovy_dashboard:read` |
| Categorías | `/app/jovy/catalogue` | `jovy_catalogue:read` |
| Nuevos Lanzamientos | `/app/jovy/launches` | `jovy_launches:read` |
| Casa Jovy Galería | `/app/jovy/brand` | `jovy_gallery:read` |
| Logos | `/app/jovy/logos` | `jovy_logos:read` |
| Anuncios de portada | `/app/jovy/announcements` | `jovy_announcements:read` |
| Novedades | `/app/jovy/novelties` | `jovy_events:read` |
| Ventas Nacionales | `/app/jovy/contacts-national-sales` | `jovy_contacts_national:read` |
| Ventas Internacionales | `/app/jovy/contacts-international-sales` | `jovy_contacts_international:read` |
| Atención al Cliente | `/app/jovy/contacts-customer-service` | `jovy_contacts_customer_service:read` |
| Catálogo — Solicitudes | `/app/jovy/contacts-catalogue` | `jovy_contacts_catalogue:read` |

### JovyCandy · Herramientas

| Opción | Ruta | Permiso |
|---|---|---|
| Contenido Jovy | `/app/jovy-herramientas/content` | `jovy_content:read` |
| Eventos Jovy | `/app/jovy-herramientas/events` | `jovy_events:read` |
| Marketing Jovy | `/app/jovy-herramientas/marketing` | `jovy_marketing:read` |
| Contactos Jovy | `/app/jovy-herramientas/contacts` | las cuatro bandejas en `read` |

## 4. Navegación calculada

`src/lib/jovy/authz/navigation.ts` contiene el catálogo estable. `visibleNavigation(snapshot)`:

- evalúa cada opción con los permisos efectivos;
- conserva un grupo solo si al menos un hijo es visible;
- conserva un padre con hijos visibles;
- no crea rutas ejecutables.

`GET /admin/jovy/authz/navigation` devuelve el árbol filtrado del actor. Sirve para una UI
propia o un panel operativo futuro, y para pruebas de coherencia. El snapshot del middleware y
la respuesta `/authz/me` usan permisos efectivos: una denegación individual también oculta la
opción y `wildcard` solo es verdadero si no existe ninguna denegación.

## 5. Sidebar nativo: bloqueo real

No es posible filtrar el sidebar nativo sin RBAC Enterprise:

- `permissions` en `defineRouteConfig` es un no-op sin el módulo RBAC.
- El sidebar core está compilado en `@medusajs/dashboard`.
- Sustituirlo con un plugin Vite que transforme el dashboard es un parche version-specific, no
  un mecanismo oficial; no se implementó.
- Ocultar enlaces con CSS/DOM está prohibido y no se usa.

**Consecuencia:** un usuario restringido puede ver entradas nativas en el sidebar, pero al abrir
la ruta o llamar la API recibe **403**. La navegación visible no se declara resuelta.

### Preparación para RBAC oficial

Todas las rutas Jovy y la ruta de accesos declaran `permissions` con sus claves. Cuando se
licencie RBAC Enterprise:

1. registrar el módulo;
2. declarar los recursos `jovy_*` como políticas;
3. sembrar la misma matriz de roles;
4. verificar que `usePermittedNavItems` oculte las entradas.

## 6. Administración

- **Usuarios:** widget `user.details` en `Settings → Users → usuario` y enlace `user.list` en la lista.
- **Roles y matriz:** `Settings → Accesos y permisos`.
- **Navegación del actor:** endpoint de navegación; se muestra en pruebas y puede alimentar un
  panel propio.
- **Auditoría:** `GET /admin/jovy/authz/audit` y sección “Auditoría reciente” en la pantalla de
  accesos. Registra actor, acción, objetivo y claves de política; no guarda secretos ni PII.

## 7. Superficies nativas protegidas

El mapa `NATIVE_AREAS` cubre los prefijos administrativos instalados:

- productos, colecciones, categorías, opciones, tags, tipos, variantes, uploads;
- pedidos, borradores, cambios, ediciones, devoluciones, reclamos, exchanges, pagos, reembolsos,
  fulfillment y payment collections;
- clientes y grupos;
- inventario, ubicaciones y reservas;
- precios, listas y preferencias;
- promociones y campañas;
- usuarios, invitaciones y API keys;
- tiendas, regiones, monedas, impuestos, envíos, proveedores, canales, plugins, vistas, search,
  workflows-executions y configuración.

Lo no clasificado se deniega salvo `*:*`. Las lecturas mínimas del shell se permiten y la
autenticación nativa de la ruta sigue decidiendo.

## 8. Pruebas

- Unitarias de filtrado de navegación.
- HTTP: navegación de Ventas Nacionales solo muestra su bandeja; Consulta de Productos solo
  muestra el grupo Medusa; auditoría devuelve eventos sin secretos.
- E2E: `/app/settings/access` abre la pantalla; el widget aparece en el detalle nativo de usuario.
- La matriz negativa de APIs se conserva en `docs/39`.

## 9. Limitaciones y pendientes

- Sidebar nativo sin filtrado visual: **BLOQUEADO POR LICENCIA**.
- Un panel operativo separado requeriría bloquear por completo el Admin nativo para operadores
  restringidos; no se implementó.
- La navegación calculada no se aplica al sidebar distribuido.
- El mapa nativo debe revisarse al actualizar Medusa.
- RBAC Enterprise sigue sin licencia; no se registra ni se simula.

## 10. Rollback

- Retirar el widget `user-access` y la ruta `settings/access` revierte la UI.
- Retirar el registro de `jovy-authz` y ejecutar el `down` de sus migraciones elimina roles,
  asignaciones y auditoría; no toca usuarios ni tablas nativas.
- Conservar el respaldo de PostgreSQL antes de cualquier activación en producción.
