# Marketing Content en Medusa

## Estado real

- **Hero: IMPLEMENTADO Y VALIDADO.** La ruta `/app/jovy/marketing` permite alta, edición, publicación, despublicación, archivado, borrado lógico, activación, vigencia UTC, orden, CTA, color por elemento, configuración global y producto destacado. La E2E Brave cubre ciclo editorial, media PNG/JPEG/WebP real, persistencia tras recarga, reordenamiento visible en Store y Product Link A→B→null con idempotencia.
- **Banners: IMPLEMENTADO Y VALIDADO.** La pestaña Banners cubre CRUD, publicación, archivado, borrado lógico, slots `promo`/`hint`, prioridad, orden, programación UTC, frecuencia, `auto_open`, CTA, carga de imagen y contratos HTTP negativos. La E2E Brave verifica cada slot en Store y la exclusión de borradores, archivados y ventanas fuera de vigencia.

## Diseño

```mermaid
flowchart LR
  A[Medusa Admin] --> B[/admin/jovy/marketing]
  B --> C[jovy_marketing]
  C --> D[(PostgreSQL)]
  C --> E[File Module local]
  P[Product Module] <-- Module Link --> H[Hero Item]
  S[Store API con Publishable API Key] --> C
```

- `HeroItem`: contenido ES/EN, estado, activación, orden, programación UTC, CTA, color e imagen opcional.
- `MarketingBanner`: contenido ES/EN, slots `promo`/`hint`, estado, activación, prioridad, orden, programación UTC, `auto_open` y frecuencia `every`/`session`/`daily`.
- `HeroSettings`: color visual global comprobado en el administrador histórico.
- `MarketingAuditLog`: mutaciones administrativas, sin exposición Store.

La Store API exige `published`, `enabled`, vigencia actual y ausencia de soft delete. El orden es determinista y se aplica con comparadores explícitos (`compareBannerOrder`, `compareHeroOrder`), no solo con el `ORDER BY` de la base de datos:

- Hero: `sort_order ASC`, `created_at ASC`, `id ASC`.
- Banners: `priority DESC`, `sort_order ASC`, `created_at ASC`, `id ASC`.

La prioridad de un Banner domina al reordenamiento: mover un Banner de prioridad baja al inicio cambia su `sort_order`, pero no lo coloca por encima de uno con `priority` mayor. `POST .../reorder` rechaza identificadores repetidos.

La lectura Store de la galería de marca aplica además un tope defensivo de `MAX_VISIBLE_GALLERY_ITEMS` (4) después del orden `sort_order ASC, created_at ASC`. La escritura ya bloquea la quinta publicación simultánea; si datos heredados o fuera de banda superan el tope, la API devuelve sólo los cuatro primeros y registra un warning operativo con conteos, sin títulos ni identificadores de archivo.

## APIs

| Ruta | Acceso | Uso |
| --- | --- | --- |
| `GET/POST /admin/jovy/marketing/hero` | sesión Admin | Lista y alta Hero |
| `GET/PUT/DELETE /admin/jovy/marketing/hero/:id` | sesión Admin | Lectura y CRUD lógico Hero |
| `POST /admin/jovy/marketing/hero/reorder` | sesión Admin | Reordenamiento Hero |
| `GET/PUT /admin/jovy/marketing/hero/settings` | sesión Admin | Color global Hero |
| `GET/PUT /admin/jovy/marketing/hero/:id/product` | sesión Admin | Consultar, reemplazar o retirar Product Link |
| `GET/POST /admin/jovy/marketing/banners` | sesión Admin | Lista y alta Banner |
| `GET/PUT/DELETE /admin/jovy/marketing/banners/:id` | sesión Admin | CRUD lógico Banner |
| `POST /admin/jovy/marketing/banners/reorder` | sesión Admin | Reordenamiento Banner |
| `POST /admin/jovy/marketing/media` | sesión Admin | PNG/JPEG/WebP, máximo 5 MB |
| `GET /admin/jovy/marketing/media/:id` | sesión Admin | Resolver URL de File Module para edición |
| `GET /store/jovy/marketing/hero` | Store API | Hero visible, con `media_url` resuelta cuando existe |
| `GET /store/jovy/marketing/banners/:slot` | Store API | Banners visibles por slot |

Los CTA aceptan solo rutas relativas o URLs `https:`; se bloquean `javascript:` y `data:`.

## Multimedia y Product Module

El File Module local usa `@medusajs/medusa/file-local`, con archivos en `static` y acceso público de laboratorio. No debe recibir material sensible: el proveedor no ofrece privacidad de lectura. La carga verifica tamaño (5 MB), firma/MIME y decodificación con `sharp`; rechaza SVG, firmas falsas, MIME declarado distinto del real, archivos corruptos y contenido inválido. Las APIs Store resuelven el archivo publicado a URL y degradan a `media_url: null` si un archivo local fue eliminado. La validación de `sharp` no se relaja.

El Module Link `product.product <> jovy_marketing.jovy_hero_item` modela un producto para cada Hero y un producto reutilizable en varios Heroes. El workflow valida el nuevo producto antes de retirar el vínculo anterior y trata la misma selección como idempotente. La compensación de workflow retira el vínculo nuevo y restaura el anterior cuando una operación posterior falla; la función `compensateHeroProductLink` se prueba de forma unitaria y la E2E cubre A→B→null, repetición idempotente y conservación del vínculo ante un producto inexistente.

## Pendientes de prueba

- La frecuencia es un contrato editorial para el futuro storefront; el backend la persiste y expone, pero no afirma comportamiento de presentación sin storefront implementado.
- Los archivos no se borran físicamente al eliminar contenido: sin conteo de referencias global no es seguro eliminar recursos potencialmente compartidos. Las fixtures multimedia de E2E reutilizan archivos existentes o dejan el archivo huérfano a propósito; no se eliminan recursos compartidos.
- La ventana temporal se evalúa con el reloj UTC del servidor; una prueba con reloj simulado queda cubierta a nivel unitario, no con manipulación del reloj del proceso E2E.
