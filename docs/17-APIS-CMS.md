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
| brand | `GET` | `/store/jovy/brand/logos` | `apps/backend/src/api/store/jovy/brand/logos/route.ts` | `family` (string exacto, case-sensitive; si llega repetido/array se ignora el filtro) | `{ logos }` |
| contacts | `POST` | `/store/jovy/contacts` | `apps/backend/src/api/store/jovy/contacts/route.ts` | body JSON estricto | `{ accepted: true }` |
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

`GET /store/jovy/brand/gallery` aplica un tope defensivo de **4 elementos visibles**: filtra por
publicación y ventana, ordena de forma determinista (`sort_order ASC`, `created_at ASC`) y recorta a
cuatro. Si hubiera más, registra un `warn` con solo el conteo, sin títulos ni identificadores. El
detalle del contrato está en `docs/25-CONTRATOS-STOREFRONT.md` §4.4.

Cada respuesta con media resuelve `media_file_id` a `media_url` con el File Module (`file-local`,
`backend_url: http://localhost:9000/static`). Si el archivo no existe, `media_url` es `null` y el
recurso sigue respondiendo `200`: no se filtra un error de almacenamiento.

## Reglas de publicación y vigencia (lógica real)

| Recurso | `status` | `enabled` | Ventana `starts_at`/`ends_at` | `published_at` | Borrado lógico |
| --- | --- | --- | --- | --- | --- |
| Hero | `published` | `true` | Sí (`starts_at <= now <= ends_at`) | Ignorado | Excluido |
| Banner | `published` | `true` | Sí | Ignorado | Excluido |
| Evento | `published` | `true` | Sí | Ignorado | Excluido |
| Galería | `published` | `true` | Sí | Ignorado | Excluido |
| Logo | No existe el campo | `true` | No aplica | No existe el campo | Excluido |
| Página editorial | `published` | No existe el campo | No aplica | `published_at <= now` o `null` | Excluido |

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

## Paginación, filtros y orden

- Ninguna ruta Store Jovy implementa `limit`/`offset`; se envían completas. Un `?limit=20` se ignora.
- Solo logos filtra por `family`; el filtro se aplica en memoria sobre `families` y es exacto.
- El catálogo comercial usa rutas nativas de Medusa (`/store/products`, `/store/product-categories`,
  `/store/regions`), no módulos Jovy. Ahí `limit` por defecto es `50` y `offset` `0`
  (`createFindParams` de Medusa).
- Comparación útil: `GET /admin/jovy/content/pages` sí pagina (`limit` por defecto 20, máximo 100).
  La API Store no replica ese comportamiento porque no existe listado Store de páginas.

## Errores

Formas de cuerpo observadas en el código:

| Caso | HTTP | Cuerpo |
| --- | --- | --- |
| Falta `x-publishable-api-key` | `400` | `{ "type": "not_allowed", "message": "Publishable API key required in the request header: x-publishable-api-key. You can manage your keys in settings in the dashboard." }` |
| Publishable key inválida o revocada | `400` | `{ "type": "not_allowed", "message": "A valid publishable key is required to proceed with the request" }` |
| Contacto inválido (zod) | `400` | `{ "message": "La solicitud no es válida", "errors": { "formErrors": [], "fieldErrors": {...} } }` |
| Límite de contactos excedido | `429` | `{ "message": "No se puede procesar la solicitud en este momento" }` + cabecera `Retry-After` con los segundos restantes |
| Página inexistente, borrador, archivada o futura | `404` | `{ "message": "Contenido no encontrado" }` |
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
| content | `GET/POST /admin/jovy/content/pages`; `GET/PUT/DELETE /admin/jovy/content/pages/:id`; `GET .../:id/audit` | `src/api/admin/jovy/content/pages/**` |
| marketing | `GET/POST /admin/jovy/marketing/hero`; `GET/PUT/DELETE .../hero/:id`; `POST .../hero/reorder`; `GET/PUT .../hero/settings`; `GET/PUT .../hero/:id/product`; `GET/POST .../banners`; `GET/PUT/DELETE .../banners/:id`; `POST .../banners/reorder`; `POST .../media`; `GET .../media/:id`; `GET .../products` | `src/api/admin/jovy/marketing/**` |
| events | `GET/POST /admin/jovy/events`; `GET/PUT/DELETE .../:id`; `GET .../:id/audit`; `POST .../reorder`; `GET/POST .../types`; `GET/PUT/DELETE .../types/:id` | `src/api/admin/jovy/events/**` |
| brand | `GET/POST /admin/jovy/brand/gallery`; `GET/PUT/DELETE .../gallery/:id`; `GET .../gallery/:id/audit`; `POST .../gallery/reorder`; equivalentes de `logos` | `src/api/admin/jovy/brand/**` |
| contacts | `GET /admin/jovy/contacts`; `GET/PUT/DELETE /admin/jovy/contacts/:id`; `GET .../:id/audit` | `src/api/admin/jovy/contacts/**` |

Los listados admin de marketing, eventos y marca tampoco paginan; solo
`/admin/jovy/content/pages` y `/admin/jovy/contacts` paginan. El listado de contactos acepta
`limit` (1–100, por defecto 20), `offset`, `status`, `contact_type` y `q`, ordena por
`created_at DESC, id DESC` y devuelve `{ contacts, count, limit, offset }`; `q` se resuelve en SQL
sobre nombre, apellidos, email y tipo, no en memoria, para que la paginación no oculte
coincidencias.

## Compatibilidad

- Añadir campos nuevos a una respuesta es retrocompatible; renombrar, anidar o eliminar campos
  requiere decisión explícita y ventana de migración porque el storefront se acopla a esta forma.
- Las claves de envelope (`hero_items`, `banners`, `items`, `logos`, `events`, `page`) son parte del
  contrato actual y no deben cambiarse por estética.
- `media_url` debe tratarse como URL opaca: el host depende de `backend_url` del File Module.
- Los códigos `404` de contenido no publicado son deliberados (no filtrar existencia); no
  convertirlos a `403`.
