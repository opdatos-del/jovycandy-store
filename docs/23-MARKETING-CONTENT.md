# Marketing Content en Medusa

## Estado real

- **Hero: IMPLEMENTADO Y VALIDADO PARCIALMENTE.** La ruta `/app/jovy/marketing` permite alta, edición, publicación, despublicación, archivado, borrado lógico, activación, vigencia UTC, orden, CTA, color por elemento y configuración global. La E2E Brave aprobada cubre el ciclo editorial básico.
- **Banners: IMPLEMENTADO SIN VALIDAR.** La misma ruta incorpora la pestaña Banners: CRUD, publicación, archivado, borrado lógico, slots `promo`/`hint`, prioridad, orden, programación, frecuencia, CTA y carga de imagen. Falta E2E exclusiva.

No se declara aceptación completa de Hero ni de Banners hasta ejecutar su matriz ampliada de multimedia, Product Links y programación.

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

La Store API exige `published`, `enabled`, vigencia actual y ausencia de soft delete. El orden es determinista: Hero por `sort_order`, Banners por `priority DESC`, `sort_order ASC`, `created_at ASC`.

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

El File Module local usa `@medusajs/medusa/file-local`, con archivos en `static` y acceso público de laboratorio. No debe recibir material sensible: el proveedor no ofrece privacidad de lectura. La carga verifica tamaño (5 MB), firma/MIME y decodificación con `sharp`; rechaza SVG y contenido inválido. Las APIs Store resuelven el archivo publicado a URL y degradan a `media_url: null` si un archivo local fue eliminado.

El Module Link `product.product <> jovy_marketing.jovy_hero_item` modela un producto para cada Hero y un producto reutilizable en varios Heroes. El workflow valida el nuevo producto antes de retirar el vínculo anterior y trata la misma selección como idempotente. La compensación de workflow retira el vínculo nuevo y restaura el anterior cuando una operación posterior falla. La validación de fallo inducido y concurrencia sigue pendiente.

## Pendientes de prueba

- Hero: PNG/JPEG/WebP, contenido truncado/MIME falso/>5MB, persistencia tras reinicio, sustitución visual de media, Product A→B→null, idempotencia y compensación.
- Banners: E2E de CRUD visual, frecuencia, prioridad, orden, vigencia y exclusión Store.
- Los archivos no se borran físicamente al eliminar contenido: sin conteo de referencias global no es seguro eliminar recursos potencialmente compartidos. Se debe limpiar cada fixture de prueba solo tras comprobar sus referencias.
- La frecuencia es un contrato editorial para el futuro storefront; el backend la persiste y expone, pero no afirma comportamiento de presentación sin storefront implementado.
