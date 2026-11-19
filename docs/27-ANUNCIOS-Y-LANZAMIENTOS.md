# Anuncios, lanzamientos y catálogo de presentación

Estado: **IMPLEMENTADO Y VALIDADO** (backend y Admin). Las tres pantallas existen en
`src/admin/routes/jovy/{catalogue,launches,announcements}/` y tienen E2E propio; este documento
describe el contrato que consumen y las reglas que aplican.

Alcance: tres piezas del Admin histórico (`admin-webjovy`) que no existían en Medusa.

| Pieza histórica | Módulo Medusa | Modelo | Reutiliza |
| --- | --- | --- | --- |
| Categorías del catálogo (6 tarjetas) | `jovy_catalogue` (nuevo) | `jovy_catalogue_category` | File Module para imágenes |
| Familias reales (`family_id`) | `jovy_catalogue` (nuevo) | `jovy_product_family` | Module Link con `product.product` |
| Nuevos lanzamientos | `jovy_launches` (nuevo) | `jovy_launch` + `jovy_launch_settings` | Product Module (solo `product_id`) |
| Anuncios: modal promo | `jovy_marketing` (existente) | `jovy_marketing_banner` slot `promo` | **Nada nuevo**: el banner ya cubría el modal |
| Anuncios: mensaje corporativo (hoy en Marketing Jovy) | `jovy_marketing` (existente) | `jovy_announcement_settings` (nuevo) | — |

## 1. Categorías de presentación (`jovy_catalogue`)

No son Product Categories de Medusa. Son las seis tarjetas públicas con clave fija:

```
sazonador · chamoy · gomitas_almidon · dulces_paletas · pinatero · gomitas_grenetina
```

`jovy_catalogue_category`: `key` (único), `name`, `description`, `sort_order`, `active`,
`coming_soon`, `interaction_locked`, `image_file_id`, `image_url`, `medusa_category_id`,
`created_at`, `updated_at`, `deleted_at`.

### 1.1 Semántica de las tres banderas

| Campo | Significado | Efecto en Store |
| --- | --- | --- |
| `active` | Publicación editorial de la tarjeta | `false` ⇒ la tarjeta **no se publica**. Por sí solo no bloquea la interacción: ocultar no es lo mismo que bloquear. |
| `coming_soon` | Estado comercial «próximamente» | Es un estado **no publicado**: se persiste con `active = false` e `interaction_locked = true`. |
| `interaction_locked` | Bloqueo de interacción explícito | El storefront no debe navegar ni abrir la tarjeta. Puede estar activo con `active = true` (publicada y bloqueada) o junto a `coming_soon = true`. |

Regla e invariante, tal como las aplica el código:

- Toda escritura pasa por `normalizeCatalogueInteraction`: si `coming_soon = true`, fuerza
  `active = false` e `interaction_locked = true`. Si el formulario intenta enviar
  `interaction_locked` como `false`, el backend lo eleva a `true`, nunca al revés.
- Desmarcar `coming_soon` en una tarjeta que estaba próxima **reactiva y desbloquea**:
  `resolveCatalogueCategoryInteractionUpdate` guarda `active = true`, `coming_soon = false` e
  `interaction_locked = false`. Si esa misma escritura incluye `interaction_locked: true`, se
  conserva el bloqueo manual sobre la tarjeta publicada.
- Un guardado no relacionado conserva el estado efectivo: si no se toca `coming_soon`, no puede
  reactivar ni desbloquear una tarjeta. La transición anterior solo ocurre al retirar
  explícitamente `coming_soon`.
- `active` y `coming_soon` son columnas independientes. Una fila histórica inválida con
  `active = true` y `coming_soon = true` se normaliza en lectura (Admin y Store) como
  `active = false` + `interaction_locked = true`, igual que una escritura nueva.
- El Admin replica la transición en el formulario: marcar «Próximamente» deja la tarjeta inactiva
  y bloqueada; desmarcarlo la reactiva y desbloquea; marcar `active` limpia `coming_soon`; un
  bloqueo manual posterior se respeta.

Diferencia histórica: en el Admin histórico `active` existía en la base de datos pero la web no
lo consumía; solo `coming_soon` bloqueaba la interacción. Aquí `active` es la bandera de
publicación Store y `coming_soon` es un estado no publicado que además bloquea. `interaction_locked`
se persiste para que el contrato Store sea explícito, y se normaliza también al leer filas
históricas.

### 1.2 Creación y seed

No hay `POST /admin/jovy/catalogue/categories`: el conjunto de claves es fijo. La única vía de
creación es el seed idempotente `POST /admin/jovy/catalogue/categories/seed` (y el script de
compatibilidad). Crea solo las claves ausentes y **no reescribe** nombre, descripción, orden ni
banderas ya editadas.

El índice único parcial sobre `key` (`IDX_jovy_catalogue_category_key_unique`, `where deleted_at
is null`) impide duplicados a nivel de base, pero el workflow no captura la violación de unicidad:
si dos seeds concurrentes calculan la misma clave ausente, uno gana y el otro puede responder un
error visible (`500`) por conflicto de unicidad. La ejecución normal es manual y secuencial; el
índice es la última defensa, no una garantía de respuesta idempotente bajo concurrencia real.

Imágenes: el histórico no tenía imágenes administrables por categoría. Se agregaron
`image_file_id` (File Module) y `image_url` (URL externa HTTPS) como campos opcionales. La
respuesta Admin expone `image_resolved_url`; el Store publica `image_url` resuelta con prioridad
al archivo y degrada a `null` si el archivo ya no existe. La carga reutiliza
`POST /admin/jovy/marketing/media` (PNG/JPEG/WebP, 5 MB); no se duplicó el endpoint.

`medusa_category_id` es un enlace lógico opcional a una Product Category (sin FK). Se valida que
exista al escribir; sirve para derivar familias y para que el storefront consulte productos
publicados con las rutas nativas de Medusa.

### 1.3 Familias canónicas y compatibilidad

`jovy_product_family`: `name`, `slug` (único), `description`, `medusa_category_id`, `sort_order`,
`active`.

- El histórico derivaba las familias de `products.family_id` (slug) y guardaba arrays de
  `family_id` en los logos. Esta instancia **no tiene** `family_id` en productos.
- La relación familia → producto se modela con el Module Link
  `jovy_catalogue.jovy_product_family ⇄ product.product`
  (`src/links/product-family.ts`: la familia tiene muchos productos y cada producto, como máximo,
  una familia). No se duplica SKU, precio ni stock.
- La regla «un producto ≤ 1 familia» se valida en el script de sincronización: `planProductFamilyLinks`
  reporta como conflicto cualquier producto que ya tenga un vínculo hacia otra familia y **no lo
  reemplaza** (tampoco borra vínculos existentes). **No hay constraint de base de datos** que
  impida insertar un segundo vínculo por otra vía; hoy la única vía de creación es el script.
- `GET /admin/jovy/catalogue/families?category_key=` devuelve las familias cuyo
  `medusa_category_id` coincide con el de la tarjeta, más `product_ids`. Sin enlace comercial la
  lista es vacía: no se inventan familias.
- `src/scripts/sync-jovy-catalogue.ts` deriva familias desde las Product Categories existentes
  (nombre, handle, descripción, `rank`, `is_active`), completando el enlace cuando una familia ya
  existía por slug, y vincula cada producto a la familia de su primera categoría. Si no hay
  categorías ni productos, no crea nada. Es idempotente y registra en el log los conflictos de
  vínculo sin reemplazarlos.
- `DELETE /admin/jovy/catalogue/families/:id` es borrado lógico y retira antes los vínculos con
  productos.

## 2. Nuevos lanzamientos (`jovy_launches`)

`jovy_launch`: `product_id` (opcional, id del Product Module), `title` (obligatorio),
`description`, `image_file_id`, `image_url`, `sort_order`, `active`, `deleted_at`.

Reglas:

- `title` obligatorio (2–180).
- Debe existir **producto o imagen** (`image_file_id` o `image_url` HTTPS). Pueden coexistir.
- Si hay `product_id`, el workflow verifica que el producto exista en el Product Module. No copia
  datos comerciales.
- `active` es la única bandera de publicación; no hay `status`, `published_at` ni ventana.
- `jovy_launch_settings` es un singleton lógico con `background_color` (hex `#RGB`/`#RRGGBB`),
  por defecto `#00AFAA`. `GET` devuelve el valor por defecto si aún no hay fila.

El storefront resuelve el producto con `/store/products` a partir de `product_id`; el backend no
lo incrusta ni comprueba su publicación en cada lectura (sería un N+1 y el contrato se acoplaría
al canal de venta).

## 3. Anuncios de portada (banners) y mensaje corporativo

### 3.1 Modal promocional: sin tabla nueva

El modal histórico se mapea al banner existente con slot `promo`. **Todos los campos históricos ya
existían** en `jovy_marketing_banner`; el contrato solo se amplió de forma aditiva con
`rotation_seconds` y el valor `once` de `frequency`. No se creó otra tabla de banners.

| Campo histórico | Campo Medusa existente | Notas |
| --- | --- | --- |
| imagen | `media_file_id` + `media_url` resuelta | File Module local |
| alt | `translations.es.alt` / `translations.en.alt` | ya obligatorio en el esquema |
| enabled | `enabled` | — |
| auto_open | `auto_open` | — |
| frecuencia `session\|daily\|every\|once` | `frequency` | mismo enum ampliado; `once` = «una vez por navegador» |
| ventana programada | `starts_at` / `ends_at` | UTC |
| prioridad | `priority` | `0..1000`, domina el orden |
| slot `promo` | `slot` | `promo` \| `hint` |
| (no existía) | `status`, `sort_order`, `cta_url` | capacidades adicionales del CMS |
| (no existía) | `rotation_seconds` | duración en pantalla **por banner**; `3..60`, por defecto `8` |

Regla de publicación del modal: `status = published`, `enabled = true` y ventana vigente; se
consume en `GET /store/jovy/marketing/banners/promo`. El CRUD no se reconstruyó: los banners se
gestionan desde el CRUD unificado de Anuncios de portada (`/app/jovy/announcements`), que cubre
ambos slots con un selector de lugar; Marketing conserva Hero, edita el mensaje corporativo y enlaza
«Abrir Anuncios de portada».

Orden en el Admin: Subir/Bajar reordena la vista y, al cruzar prioridad, intercambia
prioridades con confirmación; no cambia `compareBannerOrder` ni el orden del Store.

### 3.2 Mensaje corporativo con idiomas

En el histórico el texto bajo la animación estaba hardcodeado en i18n y el slot `hint` solo
contenía una imagen. El requisito nuevo es editar ese texto.

La edición vive en **Marketing Jovy**, bajo el Hero (`CorporateMessagePanel` +
`CorporateMessageForm`, testid `marketing-corporate-block`, E2E `jovy-hero.spec.ts`); **no** en
Anuncios de portada, que solo conserva los banners `promo` y `hint`.

`jovy_announcement_settings` (singleton lógico): `corporate_message_es`,
`corporate_message_en` (ambos nullable), `updated_by`, `created_at`, `updated_at`, `deleted_at`.

- `PUT /admin/jovy/announcements/settings` es reemplazo completo: ambos idiomas viajan siempre
  (2–600 caracteres o `null`). No hay estado borrador ni ventana.
- Regla de publicación: si hay fila con un idioma no nulo, ese mensaje es público en cuanto se
  guarda. `null` significa "sin mensaje en ese idioma"; se recomienda fallback `es` → `en` en el
  storefront. Sin fila, el Store devuelve ambos en `null`.
- `updated_by` es trazabilidad interna y **no** se expone en Store.
- No se agregó auditoría a `jovy_marketing_audit_log`: su enum `entity_type` es un CHECK de la
  migración existente y no se reescriben migraciones aplicadas; `updated_by` + `updated_at`
  cubren la trazabilidad requerida.
- El mensaje corporativo es independiente del banner `hint`: pueden coexistir imagen `hint` y
  texto editable.

## 4. Endpoints

### Admin (sesión obligatoria; `/admin/jovy/*`)

| Método y ruta | Body / query | Respuesta |
| --- | --- | --- |
| `GET /admin/jovy/catalogue/categories` | — | `{ categories: [{ ..., image_resolved_url }] }` |
| `GET /admin/jovy/catalogue/categories/:id` | — | `{ category }` |
| `PUT /admin/jovy/catalogue/categories/:id` | campos parciales de la tabla 1.1 | `{ category }` |
| `POST /admin/jovy/catalogue/categories/reorder` | `{ ids: string[] }` | `{ ids }` |
| `POST /admin/jovy/catalogue/categories/seed` | — | `{ created, categories }` |
| `GET /admin/jovy/catalogue/families?category_key=` | `category_key` opcional | `{ families: [{ ..., product_ids }] }` |
| `POST /admin/jovy/catalogue/families` | `{ name, slug, description?, medusa_category_id?, sort_order?, active? }` | `201 { family }` |
| `GET/PUT/DELETE /admin/jovy/catalogue/families/:id` | parcial en `PUT` | `{ family }` / `204` |
| `POST /admin/jovy/catalogue/families/reorder` | `{ ids: string[] }` | `{ ids }` |
| `GET /admin/jovy/launches` | — | `{ launches: [{ ..., image_resolved_url }] }` |
| `POST /admin/jovy/launches` | `{ title, product_id?, image_file_id?, image_url?, description?, sort_order?, active? }` | `201 { launch }` |
| `GET/PUT/DELETE /admin/jovy/launches/:id` | parcial en `PUT` | `{ launch }` / `204` |
| `POST /admin/jovy/launches/reorder` | `{ ids: string[] }` | `{ ids }` |
| `GET/PUT /admin/jovy/launches/settings` | `{ background_color }` | `{ launch_settings }` |
| `GET/PUT /admin/jovy/announcements/settings` | `{ corporate_message_es, corporate_message_en }` | `{ announcement_settings }` |
| `POST /admin/jovy/marketing/media` | multipart `files` | reutilizado para todas las imágenes |

Errores: `400` con `{ message, errors }` (`errors` es el `flatten()` de zod); `404` para ids,
categorías comerciales o productos inexistentes; `401` sin sesión.

### Store (publishable key obligatoria)

| Método y ruta | Query | Respuesta |
| --- | --- | --- |
| `GET /store/jovy/catalogue/categories` | — | `{ categories }` |
| `GET /store/jovy/catalogue/families` | `category_key` opcional; desconocida → `404` | `{ families }` |
| `GET /store/jovy/launches` | — | `{ settings: { background_color }, launches }` |
| `GET /store/jovy/announcements/settings` | — | `{ settings: { corporate_message_es, corporate_message_en, updated_at } }` |

Formas públicas:

```json
{
  "categories": [
    {
      "id": "jcat_01J...",
      "key": "chamoy",
      "name": "Chamoy",
      "description": null,
      "sort_order": 1,
      "active": true,
      "coming_soon": false,
      "interaction_locked": false,
      "image_file_id": null,
      "image_url": null,
      "medusa_category_id": "pcat_01J..."
    }
  ]
}
```

```json
{
  "settings": { "background_color": "#00AFAA" },
  "launches": [
    {
      "id": "jlau_01J...",
      "product_id": "prod_01J...",
      "title": "Nuevo sabor",
      "description": null,
      "image_file_id": null,
      "image_url": null,
      "sort_order": 0
    }
  ]
}
```

```json
{ "settings": { "corporate_message_es": "...", "corporate_message_en": "...", "updated_at": "2026-11-13T09:00:00.000Z" } }
```

Reglas de publicación Store:

| Recurso | Se publica si | Se excluye si |
| --- | --- | --- |
| Categoría | `active = true` | `active = false`, borrado lógico |
| Familia | `active = true` | `active = false`, borrado lógico |
| Lanzamiento | `active = true` | `active = false`, borrado lógico |
| Mensaje corporativo | idioma no nulo | idioma `null` |

Orden determinista: `sort_order ASC, created_at ASC, id ASC` para categorías, familias y
lanzamientos (`compareCatalogueOrder` / `compareLaunchOrder`). El Store no expone `active`,
`deleted_at`, `created_at`, `updated_at` de las categorías, ni `updated_by`.

Idiomas: categorías, familias y lanzamientos son monolingües; solo el mensaje corporativo y los
banners usan `es`/`en`. El backend no filtra por `?locale=`; el fallback es decisión del
storefront.

## 5. Migraciones y links

| Módulo | Migración | Contenido |
| --- | --- | --- |
| `jovy_catalogue` | `Migration20261113150000` | `jovy_catalogue_category`, `jovy_product_family` (únicos parciales `key`/`slug`) |
| `jovy_launches` | `Migration20261113151000` | `jovy_launch`, `jovy_launch_settings` |
| `jovy_marketing` | `Migration20261113152000` | `jovy_announcement_settings` |

Aplicadas contra la base local con `pnpm --dir apps/backend exec medusa db:migrate`. La misma
orden creó la tabla de enlace
`jovy_catalogue_jovy_product_family_product_product` (`medusa db:migrate` sincroniza links).

Ambos módulos están registrados en `apps/backend/medusa-config.ts`. El snapshot
`.snapshot-jovy-marketing.json` se actualizó para que un futuro `db:generate` no duplique la tabla
de anuncios.

### Backfill de familias de logos: script, no migración

`Migration20261113160000` crea `jovy_brand_logo_family` y añade `families_linked`, pero **no
mapea** `jovy_brand_logo.families[]`: `jovy-brand` migra antes que `jovy-catalogue` y la tabla
canónica puede no existir todavía. El mapeo es un script idempotente
(`src/scripts/sync-brand-logo-families.ts`), no una migración. Orden recomendado:

```powershell
# 1) Migrar catálogo y marca (crea jovy_product_family y jovy_brand_logo_family)
pnpm --dir apps/backend exec medusa db:migrate

# 2) Sembrar familias canónicas y vínculos catálogo → producto
pnpm --dir apps/backend exec medusa exec ./src/scripts/sync-jovy-catalogue.ts

# 3) Backfill de familias de logos (idempotente)
pnpm --dir apps/backend exec medusa exec ./src/scripts/sync-brand-logo-families.ts
```

El script 3 solo hace coincidencia exacta por slug contra familias activas y vigentes; no crea
familias, no borra slugs legado y no reescribe un logo con `families_linked = true`. Repetirlo no
duplica vínculos. Ver `docs/23-MARKETING-CONTENT.md` §«Backfill explícito».

## 6. Pruebas

| Archivo | Capa | Cubre |
| --- | --- | --- |
| `src/lib/jovy/__tests__/catalogue.test.ts` | unitaria | seed idempotente sin pisar ediciones, `coming_soon ⇒ interaction_locked`, `active` independiente, schemas, slugs, orden |
| `src/lib/jovy/__tests__/launches.test.ts` | unitaria | título obligatorio, producto o imagen, HTTPS, defaults de PATCH, hex, orden |
| `src/lib/jovy/__tests__/announcements.test.ts` | unitaria | reemplazo completo, `null`, longitudes |
| `src/modules/jovy-catalogue/__tests__/catalogue.integration.test.ts` | módulo | unicidad de `key`/`slug`, seed repetido, filtros, borrado lógico |
| `src/modules/jovy-launches/__tests__/launches.integration.test.ts` | módulo | persistencia, orden, borrado lógico, settings singleton |
| `integration-tests/http/catalogue-launches.spec.ts` | HTTP | `401` sin sesión, `400` de validación, `404` de producto/categoría, seed, reorder, familias por categoría con Module Link, Store solo activos, publishable key |
| `e2e/jovy-catalogue-admin.spec.ts` | E2E Admin | edición de tarjetas, regla «Próximamente», imagen, reorden, vínculo comercial y ocultamiento en Store |
| `e2e/jovy-launches-admin.spec.ts` | E2E Admin | producto, imagen, orden, visibilidad, color global y rechazo de hex inválido |
| `e2e/jovy-announcements-admin.spec.ts` | E2E Admin | CRUD de banners de los slots `promo`/`hint` en Anuncios de portada; el mensaje corporativo ES/EN se cubre en `jovy-hero.spec.ts` |

Regresión consolidada final: `lint` 0, `typecheck` 0, `test:unit` 32 suites / 328 pruebas,
`test:integration:modules` 6 suites / 37 pruebas, `test:integration:http` 11 suites / 76 pruebas,
`build` OK y `test:e2e` 29 pruebas / 0 fallos en 4,1 min. Los conteos completos viven en
`docs/21-ESTADO-REESCRITURA-ADMIN.md`.

## 7. Decisiones y pendientes reales

Decisiones:

- Se reutiliza `jovy_marketing_banner` para el modal; solo se agregó la entidad del mensaje
  corporativo. No se duplicó el CRUD de banners.
- Las categorías no tienen `POST` ni borrado: claves fijas + seed idempotente.
- `interaction_locked` se guarda explícito para que Store no replique la regla; la invariante se
  aplica también en lectura para normalizar filas históricas.
- La relación familia ↔ producto usa Module Link, no una tabla de enlace propia, para no tratar
  ids de otro módulo como claves foráneas manuales.
- No se agregó auditoría a los módulos nuevos: el requisito no la pide y las migraciones
  existentes de `jovy_marketing_audit_log` no se reescriben.
- Las imágenes de categoría y lanzamiento son aditivas; el histórico no las tenía.

Pendientes:

- Asignación manual de productos a familias desde Admin: hoy solo la resuelve el script de
  compatibilidad. No hay endpoint de mutación de vínculos ni constraint de base que fuerce la
  regla «un producto ≤ 1 familia».
- El storefront debe resolver `product_id` de lanzamientos y `medusa_category_id` de categorías
  contra las rutas nativas de Medusa; el backend no incrusta productos.
- No hay invalidación on-demand de caché ni webhooks de publicación.
- `jovy_launch` no comprueba en lectura que el producto siga publicado o existente; el contrato
  asume que el storefront filtra por disponibilidad.
- El seed concurrente puede devolver `500` por violación del índice único; no hay reintento ni
  `onConflict` en el workflow.
