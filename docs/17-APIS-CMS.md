# APIs CMS

Inventario y semántica de las APIs de los módulos `jovy-*`. Este documento es la fuente de verdad
del contrato porque el repositorio **no publica OpenAPI/Swagger**: no existen archivos `openapi.*` ni
`swagger.*` y ninguna ruta declara esquemas formales.

El detalle de consumo para el futuro storefront Next.js (esquemas campo por campo, ejemplos, caché y
gaps) está en `docs/25-CONTRATOS-STOREFRONT.md`.

## Reglas de audiencia

| Prefijo | Audiencia | Autenticación | Uso permitido |
| --- | --- | --- | --- |
| `/store/jovy/*` | Público (storefront) | `x-publishable-api-key` obligatoria | Contenido publicado y comercio |
| `/admin/jovy/*` | Personal interno | `authenticate('user', ['session','bearer','api-key'])` | Gestión editorial |

`apps/backend/src/api/middlewares.ts` protege todo `/admin/jovy/*`. El middleware global de Medusa
(`ensurePublishableApiKeyMiddleware`, registrado para el namespace `/store`) exige la publishable key
en **todas** las rutas `/store/*`, incluidas las rutas Jovy, antes de ejecutar el handler.

**El storefront no debe consumir `/admin/*`.** Requiere sesión de usuario, expone borradores,
auditoría, `deleted_at` y datos personales (contactos), y no es un contrato público.

## Convenciones comunes

| Tema | Comportamiento real |
| --- | --- |
| Base URL local | `http://localhost:9000` |
| CORS Store | `STORE_CORS` (`.env.example`: `http://localhost:3000`) |
| Auth | Cabecera `x-publishable-api-key: <pk_...>` |
| Idioma | No hay filtro por locale. `?locale=` y `x-medusa-locale` los consume el middleware de Medusa y **se ignoran** en las rutas Jovy; cuando el recurso tiene `translations` se devuelven `es` y `en` juntos |
| Fechas | `dateTime` de Medusa serializado como ISO 8601 UTC (`2026-11-12T18:00:00.000Z`) |
| Envelope | Cada recurso usa su propia clave (`hero_items`, `banners`, `items`, `logos`, `events`, `page`, `accepted`); no hay envelope uniforme |
| Paginación Store | Ninguna ruta Jovy pagina; todas devuelven el conjunto completo |
| Filtros Store | Solo `GET /store/jovy/brand/logos?family=` y el path param `:slot` de banners |
| Orden | Fijado en servidor por recurso (ver tabla) |
| `ETag` / `If-None-Match` | No forma parte del contrato; no basar la caché en ellos |

## Endpoints Store existentes

| Módulo | Método | Ruta | Archivo fuente | Query / path params | Envelope |
| --- | --- | --- | --- | --- | --- |
| content | `GET` | `/store/jovy/content/pages/:slug` | `apps/backend/src/api/store/jovy/content/pages/[slug]/route.ts` | `slug` exacto (sin validar formato) | `{ page }` |
| marketing | `GET` | `/store/jovy/marketing/hero` | `apps/backend/src/api/store/jovy/marketing/hero/route.ts` | ninguno | `{ hero_items }` |
| marketing | `GET` | `/store/jovy/marketing/banners/:slot` | `apps/backend/src/api/store/jovy/marketing/banners/[slot]/route.ts` | `slot ∈ {promo, hint}`; otro valor → `404` | `{ banners }` |
| events | `GET` | `/store/jovy/events` | `apps/backend/src/api/store/jovy/events/route.ts` | ninguno | `{ events }` |
| brand | `GET` | `/store/jovy/brand/gallery` | `apps/backend/src/api/store/jovy/brand/gallery/route.ts` | ninguno | `{ items }` |
| brand | `GET` | `/store/jovy/brand/logos` | `apps/backend/src/api/store/jovy/brand/logos/route.ts` | `family` (id real o slug; si llega repetido/array se ignora el filtro) | `{ logos }` |
| contacts | `POST` | `/store/jovy/contacts` | `apps/backend/src/api/store/jovy/contacts/route.ts` | body JSON estricto | `{ accepted: true }` |
| catalogue | `GET` | `/store/jovy/catalogue/categories` | `apps/backend/src/api/store/jovy/catalogue/categories/route.ts` | ninguno | `{ categories }` |
| catalogue | `GET` | `/store/jovy/catalogue/families` | `apps/backend/src/api/store/jovy/catalogue/families/route.ts` | `category_key` opcional; desconocida → `404` | `{ families }` |
| product-editorial | `GET` | `/store/jovy/products` | `apps/backend/src/api/store/jovy/products/route.ts` | `category_key` y `family_id` opcionales; desconocidos → `404`; exige producto comercial `published` | `{ products }` |
| launches | `GET` | `/store/jovy/launches` | `apps/backend/src/api/store/jovy/launches/route.ts` | ninguno | `{ settings, launches }` |
| announcements | `GET` | `/store/jovy/announcements/settings` | `apps/backend/src/api/store/jovy/announcements/settings/route.ts` | ninguno | `{ settings }` |
| — | `GET` | `/store/custom` | `apps/backend/src/api/store/custom/route.ts` | ninguno | texto `OK`, `200` (solo diagnóstico) |

`GET /store/custom` también exige la publishable key: el middleware se registra sobre todo el
namespace `/store`.

Orden en servidor:

| Ruta | Orden |
| --- | --- |
| `marketing/hero` | `sort_order ASC`, `created_at ASC` |
| `marketing/banners/:slot` | `priority DESC`, `sort_order ASC`, `created_at ASC` |
| `events` | `priority DESC`, `sort_order ASC`, `starts_at ASC`, `created_at ASC` |
| `brand/gallery` | `sort_order ASC`, `created_at ASC` |
| `brand/logos` | `sort_order ASC`, `created_at ASC` |
| `catalogue/categories` | `sort_order ASC`, `created_at ASC` (solo `active = true`) |
| `catalogue/families` | `sort_order ASC`, `created_at ASC` (solo `active = true`) |
| `launches` | `sort_order ASC`, `created_at ASC` (solo `active = true`) |
| `products` | `sort_order ASC`, `created_at ASC`, `id ASC` (solo `editorial_status = published`) |

`GET /store/jovy/brand/gallery` aplica un tope defensivo de **4 elementos visibles**: filtra por
publicación y ventana, ordena de forma determinista (`sort_order ASC`, `created_at ASC`) y recorta a
cuatro. Si hubiera más, registra un `warn` con solo el conteo, sin títulos ni identificadores. El
detalle del contrato está en `docs/25-CONTRATOS-STOREFRONT.md` §4.4.

Cada respuesta con media resuelve `media_file_id` a `media_url` con el File Module (`file-local`,
`backend_url: FILE_BACKEND_URL ?? http://localhost:${PORT ?? 9000}/static`). Si el archivo no
existe, `media_url` es `null` y el recurso sigue respondiendo `200`: no se filtra un error de
almacenamiento.

`GET /store/jovy/brand/logos?family=` compara contra la relación real
`jovy_brand_logo_family` resuelta a `{ id, slug }`: acepta el id de la familia o su slug. Los
logos aún no vinculados (`families_linked = false`) siguen filtrándose con su array legado
`families` por coincidencia exacta, y un logo sin familias (ni relación ni legado) se devuelve
para cualquier valor de `family`. Es una decisión explícita de esta entrega: el filtro anterior
lo excluía cuando llegaba el parámetro. La respuesta publica `family_ids` y `family_slugs` resueltos y mantiene
`families` (legado) sin cambios.

`GET /store/jovy/catalogue/categories` publica solo tarjetas efectivamente activas y devuelve
`active` junto a `coming_soon` e `interaction_locked`. Una fila histórica con `active = true` y
`coming_soon = true` se normaliza como no publicada
(`coming_soon => active = false`, `interaction_locked = true`). `GET /store/jovy/catalogue/families`
también oculta las familias de una tarjeta no publicable o bloqueada: si la categoría no es
`active`, tiene `interaction_locked` o no tiene `medusa_category_id`, responde `200` con
`families: []`. Añadir `active` es retrocompatible; no cambia el envelope `{ categories }`.

## Reglas de publicación y vigencia (lógica real)

| Recurso | `status` | `enabled` | Ventana `starts_at`/`ends_at` | `published_at` | Borrado lógico |
| --- | --- | --- | --- | --- | --- |
| Hero | `published` | `true` | Sí (`starts_at <= now <= ends_at`) | Ignorado | Excluido |
| Banner | `published` | `true` | Sí | Ignorado | Excluido |
| Evento | `published` | `true` | Sí | Ignorado | Excluido |
| Galería | `published` | `true` | Sí | Ignorado | Excluido |
| Logo | No existe el campo | `true` | No aplica | No existe el campo | Excluido |
| Página editorial | `published` | No existe el campo | No aplica | `published_at <= now` o `null` | Excluido |
| Producto editorial | `published` | No existe el campo | No aplica | Informativo (`published_at` no filtra) | Excluido |
| Categoría de catálogo | No existe el campo | `active` (normalizado desde `coming_soon`) | No aplica | No aplica | Excluido |

Funciones que implementan la regla: `isMarketingVisible` (`src/lib/jovy/marketing.ts`),
`isEventVisible` (`src/lib/jovy/events.ts`), `isPublicBrandItem` (`src/lib/jovy/brand.ts`),
`isPubliclyVisible` (`src/lib/jovy/editorial-page.ts`). Las ventanas usan el reloj UTC del servidor.

Consecuencias de contrato:

- Un recurso `draft`, `archived`, deshabilitado o fuera de ventana **no aparece**; no se devuelve
  `403` ni metadatos que revelen su existencia.
- Un evento con `starts_at` futuro **no se lista** hasta que empieza (no existe "próximos eventos").
- Una galería o hero `published` con `published_at` futuro **sí se publica** (ese campo se ignora).
- Una página `published` sin `published_at` **sí es visible**.

### Gate de publicación de eventos

Publicar un evento (`status = published`) exige título en español, `title_en`
(ambos de 2–180 caracteres), `event_type_id` existente, `starts_at` y, si hay
`ends_at`, que el fin sea posterior al inicio. Si falta cualquiera de esos
datos, el Admin responde `400` con la lista de campos faltantes y el evento no
cambia de estado (`eventPublishIssues` en `src/lib/jovy/events.ts`). El estado
`cancelled` no es publicable. La Store API devuelve `title_en` junto con
`title`.

`GET /store/jovy/events` añade `media_url` y `media_type` (`image`, `gif`, `video` o `null`,
derivado de la URL del File Module). Los eventos publicados sin medio se siguen devolviendo con
`media_type: null`; el filtro histórico del carrusel (descartar sin medio) queda del lado del
storefront. Ver `docs/23-MARKETING-CONTENT.md`.

## Paginación, filtros y orden

- Ninguna ruta Store Jovy implementa `limit`/`offset`; se envían completas. Un `?limit=20` se ignora.
- Solo logos filtra por `family`; el filtro se resuelve contra la relación real
  `jovy_brand_logo_family` (id o slug) y, para logos sin vincular, contra el array legado
  `families` por coincidencia exacta.
- El catálogo comercial usa rutas nativas de Medusa (`/store/products`, `/store/product-categories`,
  `/store/regions`), no módulos Jovy. Ahí `limit` por defecto es `50` y `offset` `0`
  (`createFindParams` de Medusa).
- Comparación útil: `GET /admin/jovy/content/pages` sí pagina (`limit` por defecto 20, máximo 100) y
  `GET /admin/jovy/contacts` pagina con `limit` 10/20/50 (por defecto 20). La API Store no replica
  ese comportamiento porque no existe listado Store de páginas.

## Errores

Formas de cuerpo observadas en el código:

| Caso | HTTP | Cuerpo |
| --- | --- | --- |
| Falta `x-publishable-api-key` | `400` | `{ "type": "not_allowed", "message": "Publishable API key required in the request header: x-publishable-api-key. You can manage your keys in settings in the dashboard." }` |
| Publishable key inválida o revocada | `400` | `{ "type": "not_allowed", "message": "A valid publishable key is required to proceed with the request" }` |
| Contacto inválido (zod) | `400` | `{ "message": "La solicitud no es válida", "errors": { "formErrors": [], "fieldErrors": {...} } }` |
| Filtros de contactos inválidos | `400` | `{ "message": "Los filtros no son válidos", "errors": {...} }` |
| Actualización de contacto inválida | `400` | `{ "message": "La actualización no es válida", "errors": {...} }` (incluye `id`, `contact_type`, `message` y campos desconocidos) |
| Filtros de exportación inválidos | `400` | `{ "message": "Los filtros de exportación no son válidos", "errors": {...} }` |
| Exportación sobre 5 000 filas | `400` | `{ "message": "La exportación supera el máximo de 5000 solicitudes; acota el rango de fechas" }` |
| Restaurar contacto inexistente | `404` | `{ "message": "Solicitud no encontrada" }` |
| Límite de contactos excedido | `429` | `{ "message": "No se puede procesar la solicitud en este momento" }` + cabecera `Retry-After` con los segundos restantes |
| Página inexistente, borrador, archivada o futura | `404` | `{ "message": "Contenido no encontrado" }` |
| Ficha editorial inexistente (Admin) | `404` | `{ "message": "El producto no tiene ficha editorial" }` |
| Publicación editorial incompleta | `400` | `{ "type": "invalid_data", "message": "No se puede publicar el producto. Falta: <campos>" }` |
| `slot` fuera de `{promo, hint}` | `404` | `{ "message": "Slot no encontrado" }` |
| Método no registrado (p. ej. `GET /store/jovy/contacts`) | `404`/`405` | Respuesta del enrutador, sin contrato propio |
| Error no controlado | `500` | `{ "code": "unknown_error", "type": "unknown_error", "message": "An unknown error occurred." }` |

`errors` es el `flatten()` de zod: `formErrors: string[]` y `fieldErrors: Record<string, string[]>`
con los mensajes del esquema (los mensajes por defecto de zod 4 están en inglés, p. ej.
`Invalid email address`; solo los personalizados están en español).

Detalle de validación de contactos (`publicContactSchema`, `.strict()`):

| Campo | Tipo | Regla |
| --- | --- | --- |
| `first_name` | string | requerido, 1–100 |
| `last_name`, `phone`, `country`, `city`, `postal_code` | string \| null | opcionales, ≤100/40/100/100/30 |
| `email` | string | requerido, email, ≤254, se normaliza a minúsculas |
| `message` | string | requerido, 1–4000 |
| `contact_type` | enum | `national-sales`, `international-sales`, `customer-service`, `catalogue` |
| `website` | string | honeypot opcional, ≤200; si viene con valor responde `202` sin persistir |

Campos desconocidos → `400`. El rate limit es **en memoria por proceso**: 5 solicitudes por IP cada
10 minutos (`src/lib/jovy/contact-rate-limit.ts`) y responde `429` con `Retry-After` en segundos;
se reinicia al reiniciar el backend. `app.set("trust proxy", 1)` hace que `req.ip` use
`X-Forwarded-For`.

## Endpoints Admin (solo referencia de gestión)

No consumir desde el storefront. Se listan para trazabilidad del CMS.

| Módulo | Rutas | Archivos |
| --- | --- | --- |
| dashboard | `GET /admin/jovy/dashboard` | `src/api/admin/jovy/dashboard/**`; agregador en `src/lib/jovy/dashboard.ts` |
| content | `GET/POST /admin/jovy/content/pages`; `GET/PUT/DELETE /admin/jovy/content/pages/:id`; `GET .../:id/audit` | `src/api/admin/jovy/content/pages/**` |
| marketing | `GET/POST /admin/jovy/marketing/hero`; `GET/PUT/DELETE .../hero/:id`; `POST .../hero/reorder`; `GET/PUT .../hero/settings`; `GET/PUT .../hero/:id/product`; `GET/POST .../banners`; `GET/PUT/DELETE .../banners/:id`; `POST .../banners/reorder`; `POST .../media`; `GET .../media/:id`; `GET .../products` | `src/api/admin/jovy/marketing/**` |
| events | `GET/POST /admin/jovy/events`; `GET/PUT/DELETE .../:id`; `GET .../:id/audit`; `POST .../reorder`; `GET/POST .../types`; `GET/PUT/DELETE .../types/:id`; `POST .../media/video` (GIF/MP4/WebM ≤ 100 MB) | `src/api/admin/jovy/events/**` |
| brand | `GET/POST /admin/jovy/brand/gallery`; `GET/PUT/DELETE .../gallery/:id`; `GET .../gallery/:id/audit`; `POST .../gallery/reorder`; equivalentes de `logos` | `src/api/admin/jovy/brand/**` |
| contacts | `GET /admin/jovy/contacts`; `GET /admin/jovy/contacts/counts`; `GET /admin/jovy/contacts/export?format=csv\|xlsx&contact_type=…`; `GET /admin/jovy/contacts/export-all?contact_types=…`; `POST /admin/jovy/contacts/:id/restore`; `GET/PUT/DELETE /admin/jovy/contacts/:id`; `GET .../:id/audit` | `src/api/admin/jovy/contacts/**` |
| catalogue | `GET /admin/jovy/catalogue/categories`; `GET/PUT .../categories/:id`; `POST .../categories/reorder`; `POST .../categories/seed`; `GET/POST .../families`; `GET/PUT/DELETE .../families/:id`; `POST .../families/reorder` | `src/api/admin/jovy/catalogue/**` |
| product-editorial | `GET/PUT/DELETE /admin/jovy/products/:id/editorial`; `POST .../:id/editorial/restore`; `GET /admin/jovy/products/editorial` | `src/api/admin/jovy/products/**` |
| launches | `GET/POST /admin/jovy/launches`; `GET/PUT/DELETE .../:id`; `POST .../reorder`; `GET/PUT .../settings` | `src/api/admin/jovy/launches/**` |
| announcements | `GET/PUT /admin/jovy/announcements/settings` | `src/api/admin/jovy/announcements/**` |

El detalle de categorías de presentación, familias, lanzamientos y mensaje corporativo está en
`docs/27-ANUNCIOS-Y-LANZAMIENTOS.md`.

`GET/POST/PUT /admin/jovy/brand/logos` incorporan la relación real con familias: `family_ids`
(ids existentes de `jovy_product_family`; al escribir deben estar activos), `family_labels`
(`{ id, slug, name }`) y `unmapped_families` (slugs del array legado `families` sin familia
canónica equivalente). Las tres respuestas resuelven `media_url` con el File Module. Enviar
`family_ids` reemplaza la selección completa, incluido el array vacío; omitirlo conserva la
relación actual. Un id desconocido o una familia `active = false` responde `400`. La UI de Marca
Jovy → Logos filtra las familias con `GET /admin/jovy/catalogue/families?category_key=`, que no
hereda familias de una tarjeta sin `medusa_category_id`.

`GET /admin/jovy/dashboard` agrega en una sola petición los conteos de productos,
categorías, contenido, marketing, eventos, marca y contactos, más los borradores recientes y el
estado de los módulos CMS opcionales (`jovy_catalogue`, `jovy_launches` y anuncios). No expone
PII ni métricas sin fuente real. Los módulos opcionales se resuelven con
`allowUnregistered: true`: si no están registrados o sus tablas no están migradas, el tablero
responde igual y los marca como no instalados o sin conteos.

Los listados admin de marketing, eventos y marca tampoco paginan; solo
`/admin/jovy/content/pages` y `/admin/jovy/contacts` paginan.

### Contactos: listado, bandejas y fechas

`GET /admin/jovy/contacts` acepta:

| Query | Regla |
| --- | --- |
| `limit` | Solo `10`, `20` o `50`; por defecto `20`. Cualquier otro valor → `400`. |
| `offset` | Entero ≥ 0; por defecto `0`. El orden es `created_at DESC, id DESC`, determinista pero no estable frente a inserciones concurrentes en el borde de página. |
| `status` | `pending`, `handled` o `deleted`. `deleted` es una vista de papelera, no un valor persistido: activa `withDeleted` y filtra `deleted_at IS NOT NULL`. |
| `contact_type` | Enum de las cuatro bandejas; fuera del enum → `400` sin repetir el valor. |
| `q` | Texto 1–100; busca en SQL sobre nombre, apellido, email, teléfono, ciudad, país, CP y tipo. `%` y `_` se escapan; el teléfono tolera separadores. |
| `date_from`, `date_to` | ISO-8601 (`YYYY-MM-DD` o timestamp). Una fecha de calendario se ancla a UTC y `date_to` incluye el día completo. Formato suelto → `400`; `date_from > date_to` → `400`. |

La respuesta es `{ contacts, count, limit, offset }`. `count` refleja el filtro aplicado (incluida
la papelera), no el total de la tabla.

### Contactos: contadores

`GET /admin/jovy/contacts/counts` alimenta los contadores de las cuatro bandejas
(`national-sales`, `international-sales`, `customer-service`, `catalogue`). Agrupa en SQL con
`GROUP BY contact_type, status, (deleted_at is not null)` y no carga filas ni expone
identificadores. Los borrados lógicos se cuentan en `deleted` y no en `pending`/`handled`.
Devuelve siempre las cuatro claves, incluso en cero, más el agregado `totals`:

```json
{
  "counts": {
    "catalogue": { "pending": 2, "handled": 1, "deleted": 1, "total": 4 },
    "national-sales": { "pending": 0, "handled": 0, "deleted": 0, "total": 0 }
  },
  "totals": { "pending": 2, "handled": 1, "deleted": 1, "total": 4 }
}
```

### Contactos: actualización

`PUT /admin/jovy/contacts/:id` usa un esquema estricto. Campos permitidos:

| Campo | Regla |
| --- | --- |
| `first_name` | Texto 1–100. |
| `last_name`, `phone`, `country`, `city`, `postal_code` | Texto opcional; `""` se normaliza a `null`. Los máximos son 100/40/100/100/30. |
| `email` | Email válido ≤ 254; se normaliza a minúsculas. |
| `status` | `pending` o `handled`. Al pasar a `handled` se escriben `handled_at` y `handled_by`; al volver a `pending` se limpian. |
| `admin_notes` | Texto opcional ≤ 4 000. |

Prohibidos y rechazados con `400`: `id`, `contact_type`, `message`, `handled_at`, `handled_by`,
`created_at`, `updated_at`, `deleted_at` y cualquier campo desconocido. Cada cambio de estado, nota,
campo del remitente o restauración escribe auditoría con whitelist; el detalle de auditoría no
incluye PII.

### Contactos: restauración

`POST /admin/jovy/contacts/:id/restore` deshace el borrado lógico. Es idempotente: si la solicitud
está viva responde `200` con el registro sin cambios y no escribe auditoría. Responde `404` si el
`id` no existe. El workflow registra `action: "restore"`; la migración append-only
`Migration20261114120000` amplía el check de `jovy_contact_audit_log.action` con `restore` y
`update` (la migración anterior ya aplicada no se reescribe).

### Contactos: exportación CSV y XLSX

`GET /admin/jovy/contacts/export` exige `contact_type` para que una descarga nunca mezcle dos
bandejas. Query: `format=csv|xlsx` (`csv` por defecto), `contact_type` obligatorio, `status`
(`pending`, `handled`, `deleted`), `q`, `date_from` y `date_to`, con las mismas reglas que el
listado.

- Límite duro de **5 000 filas** por petición; si se supera responde `400` y pide acotar el rango
  de fechas. Se consulta `5 001` filas para detectar el cruce, no para truncar. La exportación no
  pagina: `limit` u `offset` se rechazan por el esquema estricto.
- Cabeceras históricas en orden: `ID`, `Tipo`, `Nombre`, `Apellido`, `Email`, `Teléfono`, `País`,
  `Ciudad`, `CP`, `Mensaje`, `Creado`.
- CSV UTF-8 con BOM y fin de línea CRLF para Excel. Las celdas con `,`, `"` o salto de línea se
  entrecomillan y duplican comillas; las que empiezan por `=`, `+`, `-`, `@` o tabulador se
  prefijan con apóstrofo para evitar inyección de fórmulas. Los CR se normalizan a LF.
- XLSX real con `exceljs` desde `lib/jovy/contacts-xlsx.ts`: una hoja con las mismas cabeceras,
  primera fila congelada, autofiltro y el mensaje con ajuste de texto. `Content-Type:
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y nombre
  `solicitudes-<contact_type>-<YYYY-MM-DD>.xlsx`.
- `Content-Disposition: attachment; filename="solicitudes-<contact_type>-<YYYY-MM-DD>.<formato>"` y
  `Cache-Control: no-store` en ambos formatos. La respuesta incluye `X-Export-Count`.
- La auditoría de la exportación va al **logger** estructurado (bandeja, formato, filas, actor,
  estado, rango de fechas y si hubo búsqueda). No se escribe en `jovy_contact_audit_log` porque esa
  tabla se indexa por `contact_request_id` y una exportación abarca varias filas; tampoco se
  registra el término de `q`, que puede contener email o teléfono.

`GET /admin/jovy/contacts/export-all` genera el **libro XLSX consolidado**: una hoja por bandeja.
Query: `contact_types` (lista separada por comas; si se omite exporta las cuatro), `status`, `q`,
`date_from` y `date_to`; no acepta `contact_type`, `limit` ni `offset`. El límite de 5 000 filas es
compartido por todo el libro. Devuelve `X-Export-Count` (filas totales) y `X-Export-Sheets`
(bandejas incluidas). La UI lo expone como «Exportar todo (Excel)» en la vista consolidada; con un
filtro de tipo activo, la vista usa la exportación por bandeja.

Todas las rutas **admin** de contactos exigen sesión (`authenticate('user', …)`) y responden `401`
sin ella. El frontend fija el tipo de cada bandeja, pero la validación real es del servidor.

## Capa editorial de producto

Módulo `jovy_product_editorial`. La ficha referencia `product_id` y nunca duplica SKU, precio, stock,
variantes ni imágenes: esos datos se leen del Product Module en cada respuesta.

### Store: `GET /store/jovy/products`

Solo devuelve fichas con `editorial_status = published`, sin borrar, con producto comercial
existente **y con `status = published` en el Product Module**. Una ficha editorial no publica el
producto comercial por sí sola. Orden: `sort_order ASC`, `created_at ASC`, `id ASC`.

```json
{
  "products": [
    {
      "id": "01J...",
      "product": { "id": "prod_...", "title": "Chamoy 250 g", "handle": "chamoy-250-g", "thumbnail": "https://..." },
      "product_status": "published",
      "gramaje": "250 g",
      "certifications": ["SGS", "OU Kosher"],
      "is_new": true,
      "sort_order": 3,
      "published_at": "2026-11-13T18:00:00.000Z",
      "family": { "id": "01J...", "slug": "chamoy", "name": "Chamoy" },
      "category_keys": ["chamoy"]
    }
  ]
}
```

`id` es el identificador de la **ficha**; la identidad comercial es `product.id`. `family` puede ser
`null`. `category_keys` son claves públicas de `jovy_catalogue_category` derivadas de las categorías
comerciales del producto.

Filtros:

| Query | Comportamiento |
| --- | --- |
| `category_key` | Enum de las seis claves; un valor fuera del enum o inexistente responde `404`. Si la tarjeta no tiene `medusa_category_id`, responde `200` con `products: []`. |
| `family_id` | Acepta el id de `jovy_product_family` o su `slug` histórico; desconocido → `404`. |

### Admin

| Ruta | Comportamiento |
| --- | --- |
| `GET /admin/jovy/products/:id/editorial` | `404` si el producto nunca tuvo ficha (no la crea). Si la ficha está borrada lógicamente responde `200` con `deleted: true` para que la UI ofrezca restaurar. |
| `PUT /admin/jovy/products/:id/editorial` | Upsert parcial y estricto: `gramaje` (≤ 50, `""` → `null`), `certifications` (catálogo permitido, sin duplicados), `sort_order` (entero ≥ 0), `is_new`, `editorial_status`. Un `product_id` desconocido → `404`. Una ficha borrada → `400` pidiendo restaurarla (nunca se resucita implícitamente). |
| `DELETE /admin/jovy/products/:id/editorial` | Borrado lógico **solo de la ficha**. `404` si no existe. |
| `POST /admin/jovy/products/:id/editorial/restore` | Deshace `deleted_at` de la ficha. `404` si el producto comercial ya no existe o si nunca hubo ficha. No toca el producto comercial. |
| `GET /admin/jovy/products/editorial` | Listado agregado; filtros `status`, `category_key`, `family_id` (id o slug) y `product_id`. `status`, `category_key` o `product_id` inválidos → `400`; familia inexistente → `404`. Envelope `{ products }` con el mismo `id` de ficha y el producto comercial anidado. |

Cada elemento Admin añade `product` (`id`, `title`, `handle`, `thumbnail`), `product_missing`,
`family`, `category_keys` y `publish_issues` (campos faltantes para publicar). Un producto comercial
eliminado deja de publicarse en Store y en Admin se marca `product_missing: true`.

`product_id` resuelve una ficha concreta sin usar el `404` del detalle. Con ese filtro el listado
incluye la ficha borrada lógicamente y expone `deleted: true` (el resto de filtros y el listado
general las excluyen). El widget del detalle de producto lo usa para resolver «sin ficha» como
`200` con `products: []`; el `GET .../:id/editorial` conserva su `404` para llamadas directas.

### Gate de publicación

`editorial_status = published` exige, con datos reales de Medusa:

1. producto comercial existente;
2. categoría de presentación válida (tarjeta de catálogo mapeada a una categoría comercial del producto);
3. familia no vacía (Module Link o primera categoría mapeada);
4. nombre (título) e imagen principal (`thumbnail`).

Si falta algo responde `400` con `{ "type": "invalid_data", "message": "No se puede publicar el producto. Falta: imagen principal" }`
y la ficha no cambia. El gramaje y las certificaciones no son requisitos. Una tarjeta de catálogo
oculta (`active = false`) sigue siendo una categoría válida.

## Compatibilidad

- Añadir campos nuevos a una respuesta es retrocompatible; renombrar, anidar o eliminar campos
  requiere decisión explícita y ventana de migración porque el storefront se acopla a esta forma.
- Las claves de envelope (`hero_items`, `banners`, `items`, `logos`, `events`, `page`) son parte del
  contrato actual y no deben cambiarse por estética.
- `media_url` debe tratarse como URL opaca: el host depende de `FILE_BACKEND_URL` o, en su defecto,
  de `http://localhost:${PORT ?? 9000}/static`.
- Los códigos `404` de contenido no publicado son deliberados (no filtrar existencia); no
  convertirlos a `403`.
