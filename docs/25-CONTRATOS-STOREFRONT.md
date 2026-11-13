# Contratos Store para el storefront Next.js

Contrato de consumo de las APIs públicas `jovy-*`. Consumidor previsto: `apps/storefront`
(Next.js 16, App Router). Fuente de verdad del inventario: `docs/17-APIS-CMS.md`.

## 1. Regla de oro

El storefront consume **solo** `/store/jovy/*` (y rutas nativas `/store/*` de Medusa cuando aplique).
Está prohibido llamar `/admin/jovy/*`: exige sesión de usuario, devuelve borradores y auditoría, y
expone datos personales de contactos. Ningún ejemplo de este documento usa Admin.

## 2. Configuración del consumidor

| Variable | Valor local | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `http://localhost:9000` (`.env.example` del storefront) | Base de las llamadas |
| `MEDUSA_PUBLISHABLE_API_KEY` | `pk_...` de `apps/backend/.store.local.env` (solo laboratorio) | Cabecera `x-publishable-api-key` |

- La publishable key es pública por diseño, pero **no autoriza contenido**: solo identifica canales de
  venta. No la uses como control de acceso.
- CORS Store permitido: `STORE_CORS` (`http://localhost:3000` en `.env.example`).
- La key es obligatoria en toda petición `/store/*`; sin ella la respuesta es `400` antes del handler.
- `media_url` es absoluta (`http://localhost:9000/static/...`); configurar `images.remotePatterns` en
  `next.config.ts` si se usa `next/image`. Tratarla como URL opaca (el host depende de `backend_url`).

Cliente mínimo (Server Component / `fetch` nativo):

```ts
const BACKEND = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL!
const KEY = process.env.MEDUSA_PUBLISHABLE_API_KEY!

const headers: HeadersInit = {
  "x-publishable-api-key": KEY,
  accept: "application/json",
}

export async function jovyGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}/store/jovy${path}`, { headers })
  if (!res.ok) throw new Error(`Jovy API ${res.status} ${path}`)
  return res.json() as Promise<T>
}
```

## 3. Resumen de contratos

| Recurso | Método y ruta | Auth | Query | Envelope | Pagina |
| --- | --- | --- | --- | --- | --- |
| Hero | `GET /store/jovy/marketing/hero` | publishable key | — | `hero_items[]` | No |
| Banners | `GET /store/jovy/marketing/banners/:slot` | publishable key | `slot` = `promo` o `hint` | `banners[]` | No |
| Productos destacados | **sin contrato Store** (ver §9) | — | — | — | — |
| Eventos | `GET /store/jovy/events` | publishable key | — | `events[]` | No |
| Galería Casa Jovy | `GET /store/jovy/brand/gallery` | publishable key | — | `items[]` | No |
| Logos | `GET /store/jovy/brand/logos` | publishable key | `family` (opcional) | `logos[]` | No |
| Páginas corporativas | `GET /store/jovy/content/pages/:slug` | publishable key | `slug` (path) | `page` | No |
| Solicitud de contacto | `POST /store/jovy/contacts` | publishable key | — | `accepted` | No |

Todas las rutas devuelven `200` (o `202` en contacto) con el conjunto completo; `limit`/`offset` se
ignoran.

## 4. Contratos por recurso

### 4.1 Hero

Archivo: `apps/backend/src/api/store/jovy/marketing/hero/route.ts`.

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `id` | string | no | Identificador del elemento |
| `translations` | `{ es: Content, en: Content }` | no | Ambos idiomas obligatorios en el esquema |
| `translations.*.title` | string | no | 2–180 caracteres |
| `translations.*.description` | string | opcional | Puede faltar la clave, no venir `null` |
| `translations.*.cta_label` | string | opcional | Puede faltar la clave |
| `background_color` | string | sí | Hex `#RGB` o `#RRGGBB` |
| `media_file_id` | string | sí | ID del File Module |
| `media_url` | string | sí | `null` si el archivo ya no existe |
| `cta_url` | string | sí | Solo `/...` o `https://...` |
| `sort_order` | number | no | Entero ≥ 0 |

Semántica: visible con `status = published`, `enabled = true` y ventana `starts_at/ends_at` actual.
`published_at` se ignora. Orden `sort_order ASC, created_at ASC`. No incluye `status`, ventana,
`published_at` ni el producto vinculado.

```json
{
  "hero_items": [
    {
      "id": "jhero_01J8Z3K4Q9",
      "translations": {
        "es": { "title": "Dulces que celebran", "description": "Nueva temporada", "cta_label": "Ver catálogo" },
        "en": { "title": "Sweets that celebrate", "description": "New season", "cta_label": "Browse catalogue" }
      },
      "background_color": "#00AFAA",
      "media_file_id": "file_01J8Z3K4Q9",
      "media_url": "http://localhost:9000/static/jovy-marketing-8f0c.webp",
      "cta_url": "/catalogo",
      "sort_order": 0
    }
  ]
}
```

Estado sin elementos publicados: `{ "hero_items": [] }`.

### 4.2 Banners

Archivo: `apps/backend/src/api/store/jovy/marketing/banners/[slot]/route.ts`.

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `id` | string | no | |
| `translations` | `{ es: BannerContent, en: BannerContent }` | no | `alt` obligatorio en cada idioma |
| `translations.*.title` | string | no | 2–180 |
| `translations.*.alt` | string | no | 1–255, texto alternativo de la imagen |
| `translations.*.description` | string | opcional | |
| `translations.*.cta_label` | string | opcional | |
| `media_file_id` | string | sí | |
| `media_url` | string | sí | |
| `cta_url` | string | sí | `/...` o `https://...` |
| `auto_open` | boolean | no | Contrato editorial; el backend no abre nada |
| `frequency` | `"every" \| "session" \| "daily"` | no | Semántica de presentación a cargo del frontend |
| `priority` | number | no | Entero 0–1000 |
| `sort_order` | number | no | Entero ≥ 0 |

`slot` es path param: `promo` o `hint`. Cualquier otro valor → `404 { "message": "Slot no encontrado" }`
antes de consultar datos. Visible con `published` + `enabled` + ventana. Orden
`priority DESC, sort_order ASC, created_at ASC`. La respuesta no repite `slot` ni expone la ventana.

```json
{
  "banners": [
    {
      "id": "jban_01J8Z3K5A1",
      "translations": {
        "es": { "title": "Envío gratis desde $999", "alt": "Caja de dulces Jovy", "description": "Todo México", "cta_label": "Comprar" },
        "en": { "title": "Free shipping from $999", "alt": "Jovy candy box", "description": "All Mexico", "cta_label": "Shop" }
      },
      "media_file_id": "file_01J8Z3K5A2",
      "media_url": "http://localhost:9000/static/jovy-marketing-1a2b.webp",
      "cta_url": "https://example.com/promo",
      "auto_open": true,
      "frequency": "daily",
      "priority": 10,
      "sort_order": 0
    }
  ]
}
```

### 4.3 Eventos

Archivo: `apps/backend/src/api/store/jovy/events/route.ts`.

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `id` | string | no | |
| `event_type_id` | string | sí | Sin nombre ni código del tipo |
| `title` | string | no | 2–180 |
| `title_en` | string | sí | 2–180; obligatorio para publicar, puede faltar en eventos antiguos |
| `slug` | string | no | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 2–180, único |
| `description` | string | sí | ≤2000 |
| `content` | string | sí | ≤20000, se envía completo en el listado |
| `starts_at` | ISO string | sí | UTC |
| `ends_at` | ISO string | sí | UTC |
| `priority` | number | no | 0–1000 |
| `sort_order` | number | no | ≥0 |
| `media_file_id` | string | sí | |
| `media_url` | string | sí | |

Visible con `status = published` y `enabled = true`, y `starts_at <= now <= ends_at` cuando existan.
`draft`, `archived`, `cancelled` y deshabilitados quedan fuera. `published_at` se ignora.
Un evento con `starts_at` futuro **no se devuelve**. Orden
`priority DESC, sort_order ASC, starts_at ASC, created_at ASC`.

Gate de publicación (Admin): para pasar a `published` el evento debe tener
`title` (ES), `title_en`, `event_type_id` existente y `starts_at`; si hay
`ends_at`, debe ser posterior a `starts_at`. La Store API devuelve `title_en`
tal como se guardó, incluido `null` si el evento se creó antes de la migración
`Migration20261113093000`. `cancelled` nunca es publicable.

```json
{
  "events": [
    {
      "id": "jevt_01J8Z3K6B7",
      "event_type_id": "jevttype_01J8Z3K6B8",
      "title": "Feria Jovy Monterrey",
      "title_en": "Jovy Monterrey Fair",
      "slug": "feria-jovy-monterrey",
      "description": "Activación de marca con dulces de temporada.",
      "content": "## Programa\n\n11:00 Apertura de stands...",
      "starts_at": "2026-11-12T16:00:00.000Z",
      "ends_at": "2026-11-12T23:00:00.000Z",
      "priority": 5,
      "sort_order": 0,
      "media_file_id": "file_01J8Z3K6B9",
      "media_url": "http://localhost:9000/static/jovy-marketing-77aa.webp"
    }
  ]
}
```

### 4.4 Galería Casa Jovy

Archivo: `apps/backend/src/api/store/jovy/brand/gallery/route.ts`.

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `id` | string | no | |
| `title` | string | sí | ≤180 |
| `description` | string | sí | ≤2000 |
| `sort_order` | number | no | ≥0 |
| `media_url` | string | sí | `null` si el archivo faltaba al resolver |

Visible con `status = published` + `enabled = true` + ventana. `published_at` se ignora. Sin idiomas
(campos únicos, no `translations`). Orden `sort_order ASC, created_at ASC`.

La lectura aplica un tope defensivo de **4 elementos visibles**: tras filtrar por publicación y
ventana, ordena de forma determinista y recorta a cuatro. Si hubiera más, el backend registra un
`warn` con solo el conteo (sin títulos, IDs ni URLs). Este tope no sustituye la validación de
escritura con Locking Module; la cubre la prueba unitaria
`apps/backend/src/api/store/jovy/brand/__tests__/route.test.ts`.

```json
{
  "items": [
    {
      "id": "jgal_01J8Z3K7C1",
      "title": "Casa Jovy",
      "description": "Fachada histórica de la planta.",
      "sort_order": 0,
      "media_url": "http://localhost:9000/static/jovy-marketing-33cd.webp"
    }
  ]
}
```

### 4.5 Logos

Archivo: `apps/backend/src/api/store/jovy/brand/logos/route.ts`.

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `id` | string | no | |
| `slug` | string | no | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤100, único |
| `name` | string | no | ≤255 |
| `alt` | string | sí | |
| `families` | string[] | sí | Hasta 30 etiquetas libres |
| `crop` | `{ zoom, offset_x, offset_y }` | sí | `zoom` 0.25–2 |
| `sort_order` | number | no | |
| `media_url` | string | sí | |

Semántica: **no hay estado editorial ni ventana**; el único filtro es `enabled = true`. El query
`family` compara con `families.includes(family)` (exacto, case-sensitive; sin recortar espacios). Si
el parámetro llega como array (`?family=a&family=b`) el backend lo ignora y devuelve todos.
Orden `sort_order ASC, created_at ASC`.

```json
{
  "logos": [
    {
      "id": "jlogo_01J8Z3K8D2",
      "slug": "jovy-corporativo",
      "name": "Jovy Corporativo",
      "alt": "Logotipo Jovy",
      "families": ["corporativa", "demo"],
      "crop": { "zoom": 1.25, "offset_x": 12, "offset_y": 0 },
      "sort_order": 0,
      "media_url": "http://localhost:9000/static/jovy-marketing-55ef.webp"
    }
  ]
}
```

### 4.6 Páginas corporativas

Archivo: `apps/backend/src/api/store/jovy/content/pages/[slug]/route.ts`.

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `page.slug` | string | no | Clave de ruta; ≤120 y `^[a-z0-9]+(?:-[a-z0-9]+)*$` al escribir, no se valida al leer |
| `page.translations` | `{ es: Content, en: Content }` | no | `title` obligatorio por idioma |
| `page.translations.*.title` | string | no | 2–180 |
| `page.translations.*.excerpt` | string | opcional | ≤320 |
| `page.translations.*.body` | string | opcional | ≤50000 |
| `page.seo` | `{ es?: Seo, en?: Seo }` | sí | Objeto parcial por idioma |
| `page.seo.*.title` | string | opcional | ≤180 |
| `page.seo.*.description` | string | opcional | ≤320 |
| `page.seo.*.image_file_id` | string | opcional | ID de archivo **sin URL pública** (ver §10) |
| `page.published_at` | ISO string | sí | |
| `page.updated_at` | ISO string | no | Aportado por Medusa |

Visible solo con `status = published` y (`published_at` nulo o `<= now`). Cualquier otro caso → `404`.
No se expone `id`, `status`, `deleted_at` ni auditoría. Slug inexistente y página en borrador
devuelven el mismo `404` (no se filtra existencia).

```json
{
  "page": {
    "slug": "nosotros",
    "translations": {
      "es": { "title": "Nosotros", "excerpt": "Más de 70 años endulzando México.", "body": "<p>...</p>" },
      "en": { "title": "About us", "excerpt": "Over 70 years sweetening Mexico.", "body": "<p>...</p>" }
    },
    "seo": {
      "es": { "title": "Nosotros | Jovy", "description": "Historia de Casa Jovy.", "image_file_id": "file_01J8Z3K9E1" },
      "en": { "title": "About us | Jovy", "description": "The story of Casa Jovy." }
    },
    "published_at": "2026-11-01T15:00:00.000Z",
    "updated_at": "2026-11-10T09:30:00.000Z"
  }
}
```

`404`:

```json
{ "message": "Contenido no encontrado" }
```

### 4.7 Solicitud de contacto

Archivo: `apps/backend/src/api/store/jovy/contacts/route.ts`. Workflow:
`apps/backend/src/workflows/jovy-contacts/contact.ts`.

Request (`Content-Type: application/json`, esquema `.strict()`):

```json
{
  "first_name": "Ana",
  "last_name": "Pérez",
  "email": "ana@example.com",
  "phone": "+528100000000",
  "country": "MX",
  "city": "Monterrey",
  "postal_code": "64000",
  "contact_type": "national-sales",
  "message": "Quiero distribuir productos Jovy en mi estado.",
  "website": ""
}
```

| Campo | Tipo | Obligatorio | Regla |
| --- | --- | --- | --- |
| `first_name` | string | sí | 1–100 |
| `last_name` | string | no | ≤100, admite `null` |
| `email` | string | sí | email ≤254, se guarda en minúsculas |
| `phone` | string | no | ≤40 |
| `country` | string | no | ≤100 |
| `city` | string | no | ≤100 |
| `postal_code` | string | no | ≤30 |
| `message` | string | sí | 1–4000 |
| `contact_type` | enum | sí | `national-sales` \| `international-sales` \| `customer-service` \| `catalogue` |
| `website` | string | no | Honeypot ≤200; con valor se responde `202` sin guardar |

Respuesta aceptada (`202`), idéntica para envío real y honeypot:

```json
{ "accepted": true }
```

Errores:

| Caso | HTTP | Cuerpo |
| --- | --- | --- |
| Validación | `400` | `{ "message": "La solicitud no es válida", "errors": { "formErrors": [], "fieldErrors": { "email": ["Invalid email address"] } } }` |
| Rate limit (5/10 min por IP) | `429` | `{ "message": "No se puede procesar la solicitud en este momento" }` + `Retry-After` con los segundos restantes |

Notas de contrato: el endpoint **no es idempotente** (cada `202` crea una solicitud nueva), no acepta
`Idempotency-Key`, envía `Retry-After` sólo en el `429` y el limitador es en memoria por proceso. Las
solicitudes que fallan la validación (`400`) no consumen cuota; el honeypot sí. La IP proviene de
`req.ip` con `trust proxy = 1`. Ante `429` no reintentar automáticamente en el navegador antes de que
transcurra `Retry-After`.

## 5. Idiomas y fallback

- Idiomas soportados: `es` y `en`, ambos obligatorios en el esquema de Hero, Banners y Páginas.
- Galería y Logos son monolingües (no tienen `translations`).
- Eventos no usa `translations`: expone `title` (ES) y `title_en` (EN); los
  demás campos son únicos. `title_en` puede ser `null` en eventos anteriores a
  la migración `20261113093000`, aunque el gate actual exige ambos títulos para
  publicar.
- No existe `?locale=` funcional ni `Accept-Language` en estas rutas: pedir `?locale=en` devuelve lo
  mismo (el middleware lo consume y la ruta lo ignora). La selección de idioma es responsabilidad del
  storefront.
- Fallback recomendado (decisión de presentación, no del backend): usar `es` por defecto y caer a
  `es` si la clave opcional (`description`, `cta_label`, `excerpt`, `body`) falta en `en`.
- `title` y `alt` de banners no requieren fallback: el esquema los exige en ambos idiomas.

## 6. Caché recomendada (derivada de la semántica real)

El backend no define `Cache-Control` ni contrato de `ETag`. Toda la estrategia vive en Next.js.
La visibilidad depende de `now` (`starts_at`/`ends_at`) **sin escritura**, así que la invalidación por
tag sola no basta: hay que acotar el `revalidate`.

| Endpoint | `revalidate` | Tag propuesto | Motivo |
| --- | --- | --- | --- |
| `/store/jovy/marketing/hero` | 60 s | `jovy:hero` | Ventana puede expirar/entrar sin escritura |
| `/store/jovy/marketing/banners/:slot` | 60 s | `jovy:banners:<slot>` | Igual, más `priority` y ventana |
| `/store/jovy/events` | 60 s | `jovy:events` | `starts_at` hace aparecer eventos |
| `/store/jovy/brand/gallery` | 60 s | `jovy:gallery` | Ventana por elemento |
| `/store/jovy/brand/logos` | 3600 s | `jovy:logos` / `jovy:logos:<family>` | Sin estado ni ventana; solo `enabled` |
| `/store/jovy/content/pages/:slug` | 300 s | `jovy:page:<slug>` | Solo cambia al publicar/editar |
| `POST /store/jovy/contacts` | `cache: "no-store"` | — | Mutación no idempotente |

Ejemplo:

```ts
export async function getPage(slug: string) {
  const res = await fetch(`${BACKEND}/store/jovy/content/pages/${slug}`, {
    headers: { "x-publishable-api-key": KEY },
    next: { revalidate: 300, tags: [`jovy:page:${slug}`] },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`page ${slug}: ${res.status}`)
  return res.json()
}
```

Para contacto, `fetch(..., { method: "POST", cache: "no-store" })` y nunca reenviar el cuerpo
automáticamente tras un `429`/timeout.

No cachear `404` de páginas de forma permanente: una página puede publicarse después. Un `404`
cacheado debe tener el mismo TTL corto o invalidarse por tag.

## 7. Estados de publicación expuestos (resumen)

| Recurso | Se publica si | Se excluye si |
| --- | --- | --- |
| Hero / Banner | `published` + `enabled` + dentro de ventana | Borrador, archivado, deshabilitado, fuera de ventana, borrado lógico |
| Evento | `published` + `enabled` + dentro de ventana | `draft`, `archived`, `cancelled`, deshabilitado, futuro o terminado |
| Galería | `published` + `enabled` + dentro de ventana | Igual que Hero; la lectura devuelve como máximo 4 visibles |
| Logo | `enabled = true` | Deshabilitado, borrado lógico |
| Página | `published` + `published_at` nulo o pasado | Borrador, archivado, `published_at` futuro, borrado lógico |

## 8. Diferencias entre listado y detalle

| Recurso | Store | Admin (referencia) |
| --- | --- | --- |
| Página corporativa | Solo detalle por `slug`; **no hay listado Store** | Listado paginado con borradores |
| Evento | Solo listado (incluye `content` completo); **no hay detalle por `slug`** | Listado y CRUD por `id` |
| Hero, Banner, Galería, Logos | Solo listado; el detalle se resuelve en cliente por `id`/`slug` | CRUD por `id` |
| Contacto | Solo `POST`; no hay lectura pública | Listado y detalle privados con PII |

## 9. Productos destacados

Estado real: **no existe contrato Store**. El vínculo editorial existe en el CMS
(`apps/backend/src/links/product-hero-item.ts`, `ProductModule.product` ⇄ `jovy_hero_item`, `isList`),
pero:

- `GET /store/jovy/marketing/hero` no devuelve `product`, ni `product_id`, ni handle.
- El único acceso es Admin: `GET/PUT /admin/jovy/marketing/hero/:id/product` (prohibido al storefront).
- `GET /admin/jovy/marketing/products` (Admin) es el buscador de productos del CMS, tampoco consumible.

Por tanto el storefront **hoy no puede** renderizar el producto destacado de cada Hero. Opciones
(ninguna implementada):

| Opción | Cambio | Compatibilidad |
| --- | --- | --- |
| A (recomendada) | Añadir `product: { id, title, handle, thumbnail } \| null` a cada `hero_items[]` | Aditivo, no rompe consumidores |
| B | Nueva ruta `GET /store/jovy/marketing/hero/:id/product` | Aditiva; requiere N+1 desde el cliente |
| C | Resolver por `/store/products?handle=` | Solo viable si el Hero expone el handle (no lo hace) |

La forma `{ id, title, handle, thumbnail }` ya se usa en el Admin (`product.id`, `product.title`,
`product.thumbnail` en `hero/[id]/product/route.ts`); conviene reutilizarla. `thumbnail` puede ser
`null`. El producto debe verificarse como publicado en su canal de venta al momento de exponerlo, no
solo al vincularlo.

## 10. Gaps detectados y recomendación mínima

| # | Gap | Impacto | Recomendación mínima |
| --- | --- | --- | --- |
| 1 | Hero no expone el producto destacado | No se puede renderizar "destacados" | Opción A de §9 |
| 2 | No hay listado Store de páginas | No se puede construir índice/`sitemap` | `GET /store/jovy/content/pages?limit&offset` público con `slug`, `updated_at`, `published_at` |
| 3 | No hay detalle de evento por `slug` | Rutas `/eventos/[slug]` dependen de un listado que oculta eventos pasados | `GET /store/jovy/events/:slug` con la misma regla de visibilidad |
| 4 | Eventos futuros invisibles | No existe "próximos eventos" ni agenda | Parámetro `scope=current\|upcoming\|past` (por defecto el actual) |
| 5 | Sin paginación en listas | Crecimiento no acotado de galería, eventos y logos | `limit`/`offset` con `limit` por defecto 20 y máximo 100, más `count` |
| 6 | Logos sin `family` repetible y case-sensitive | Filtros frágiles | Aceptar lista (`family=a,b` o repetido) y normalizar a minúsculas |
| 7 | `seo.image_file_id` sin URL pública | Metadatos OG sin imagen | Exponer `seo.*.image_url` resuelta (o `GET /store/jovy/media/:id` público de solo lectura) |
| 8 | Sin webhook/subscriber de publicación | ISR sin invalidación on-demand | Subscriber de Medusa que llame a un endpoint de revalidación del storefront con el tag afectado |
| 9 | Eventos solo traen `event_type_id` | No se puede etiquetar/agrupar | Incluir `event_type: { code, name } \| null` |
| 10 | Hero/Banner ocultan `starts_at`/`ends_at` | El cliente no puede anticipar expiración | Incluirlos si se necesita countdown o rendimiento de caché |
| 11 | `hero_settings` (color global) es solo Admin | El frontend no conoce el color por defecto `#00AFAA` | Exponer `settings` en la respuesta de Hero |
| 12 | Contacto no idempotente (sí envía `Retry-After` en `429`) | Duplicados por doble clic/reintento | Aceptar `Idempotency-Key` o deduplicar por `email+message` en ventana corta |
| 13 | Rate limit por proceso | Se reinicia al reiniciar y no escala horizontal | Documentar como límite de laboratorio; usar almacén compartido si se despliega |
| 14 | Sin OpenAPI | Contrato solo en Markdown | Publicar OpenAPI 3.1 cuando se establezca el storefront y generar tipos |
| 15 | Tipos de evento sin contrato Store y unicidad de `code` a medio documentar | El frontend solo recibe `event_type_id`; el Admin puede reutilizar un `code` tras borrado lógico | El índice único parcial (`where deleted_at is null`) existe en `Migration20261113090000`; queda pendiente una prueba de concurrencia y decidir si la reutilización de códigos borrados es deseada. Exponer `event_type: { code, name }` cuando se abra el contrato Store |

Ninguna recomendación está implementada en este cambio.

## 11. Verificación

Pruebas existentes que fijan el comportamiento Store (no modificar sin actualizar el contrato):

| Archivo | Cubre |
| --- | --- |
| `apps/backend/e2e/jovy-hero.spec.ts` | Publicado aparece; archivado desaparece; reordenamiento, media y producto |
| `apps/backend/e2e/jovy-banners.spec.ts` | Slots, prioridad, frecuencia, ventana UTC, `auto_open`, CTA y negativos `400` |
| `apps/backend/e2e/jovy-events.spec.ts` | Visibilidad por estado, gate de publicación, `title_en`, multimedia y prioridad |
| `apps/backend/e2e/jovy-brand.spec.ts` | Galería publicada/archivada y logos con `family`; no ejercita el tope de lectura |
| `apps/backend/src/api/store/jovy/brand/__tests__/route.test.ts` | Tope defensivo de 4 elementos visibles y warning de solo conteos, sin PII |
| `apps/backend/e2e/jovy-content.spec.ts` | `200` publicado, `404` archivado |
| `apps/backend/e2e/jovy-contacts.spec.ts` | `400`, `202`, `429` con `Retry-After`, honeypot y `GET` no permitido |

Comandos:

```powershell
# Definir primero la key (valor real en apps/backend/.store.local.env)
$env:MEDUSA_PUBLISHABLE_API_KEY = "pk_..."

pnpm --dir apps/backend test:e2e

curl.exe -s http://localhost:9000/store/jovy/marketing/hero `
  -H "x-publishable-api-key: $env:MEDUSA_PUBLISHABLE_API_KEY"

curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:9000/store/jovy/content/pages/nosotros `
  -H "x-publishable-api-key: $env:MEDUSA_PUBLISHABLE_API_KEY"
```

## 12. Compatibilidad y evolución

- Sin consumidor en producción todavía (`apps/storefront` no consume estas rutas), así que el coste de
  corregir gaps es bajo **si se decide antes** de implementar el storefront.
- Toda evolución debe ser aditiva: nuevos campos y nuevos endpoints. Cambiar el envelope
  (`hero_items` → `items`), renombrar campos o mover `translations` rompe consumidores.
- Los `404` de contenido no publicado son intencionales; no convertirlos en `403`.
- Si se publica OpenAPI 3.1, este documento y las pruebas de contrato deben actualizarse en el mismo
  cambio.
