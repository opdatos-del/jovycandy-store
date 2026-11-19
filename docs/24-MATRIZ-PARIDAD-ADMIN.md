# Matriz de paridad — administrador histórico vs CMS Medusa

**Estado:** auditoría documental sobre el árbol de trabajo. Esta actualización solo edita documentación: no modifica `apps/**`, no toca proyectos históricos y no hace commits.

**Alcance:** esta sigue siendo la matriz **técnica por funcionalidad** (modelo, API, workflow y prueba). La paridad **por pantalla** —13 opciones del menú histórico contra el sidebar real de Medusa, con CRUD y E2E por pantalla— vive en `docs/28-MATRIZ-PARIDAD-PANTALLAS.md`. Ambas matrices se complementan: aquí se juzga la capacidad, allí se juzga la pantalla que la expone. No se duplican filas entre ambas.

**Fecha de corte:** 2026-11-14.

**Fuentes principales:** `docs/13-AUDITORIA-ADMIN-ORIGINAL.md`, `docs/14-MAPEO-ADMIN-MEDUSA.md`, `docs/21-ESTADO-REESCRITURA-ADMIN.md`, `docs/23-MARKETING-CONTENT.md`, `docs/25-CONTRATOS-STOREFRONT.md`, `docs/27-ANUNCIOS-Y-LANZAMIENTOS.md`, `docs/28-MATRIZ-PARIDAD-PANTALLAS.md`, `docs/29-PARIDAD-VISUAL-FUNCIONAL-CMS.md`, código de `apps/backend` y specs E2E/unitarias/integración.

**Nota metodológica:** esta matriz se contrastó contra el código y las pruebas del árbol de trabajo al 2026-11-14. `docs/17-APIS-CMS.md` es la fuente de verdad del inventario de APIs y está sincronizado con el código; `docs/16` y `docs/20` no se usan como evidencia. La regresión agrupada de Playwright quedó estable tras corregir el watcher de `medusa develop` (ver `docs/21`); las catorce specs E2E corren con `workers: 1` en un solo comando. La revisión de esta matriz no re-ejecutó la suite: usa los conteos consolidados de `docs/21`. La paridad **visual** no se evalúa aquí; `docs/29` mantiene la mayoría de pantallas en `Parcial` por ausencia de captura histórica pareada.

## Criterios de clasificación

| Categoría | Criterio aplicado |
| --- | --- |
| `Implementada y validada` | Existe código y al menos una prueba unitaria, E2E o validación HTTP documentada que ejercita la funcionalidad. |
| `Implementada parcialmente` | Existe código, pero falta cubrir una parte funcional o no hay prueba suficiente; también aplica cuando la UI no expone lo que la API/modelo soportan. |
| `Resuelta por Medusa nativo` | La capacidad pertenece al Admin/API nativo de Medusa; no se implementó código propio y no se duplica información comercial. |
| `Pendiente` | No se encontró modelo, migración, ruta, workflow, UI ni prueba en el repositorio. |
| `Descartada justificadamente` | Existe una decisión explícita de no reconstruirla en esta fase. |

## Evidencia de prueba disponible

| Evidencia | Cobertura real |
| --- | --- |
| `pnpm --dir apps/backend test:unit` | 29 suites / 275 pruebas: reglas de publicación, esquemas, orden, auditoría sin PII, rate limit, paginación/filtros, catálogo, lanzamientos, anuncios, producto editorial, contactos, export CSV y restauración. |
| `pnpm --dir apps/backend test:integration:modules` | 6 suites / 37 pruebas con PostgreSQL real: límite concurrente de cuatro en Galería, crop no destructivo, medios compartidos, `media_file_id` inexistente, paginación/filtros/soft delete/restore de contactos, catálogo, lanzamientos y producto editorial. |
| `apps/backend/src/lib/jovy/__tests__/marketing.test.ts` | Visibilidad, bordes UTC, CTA seguro, payloads de banner, frecuencia, reordenamiento y orden determinista. |
| `apps/backend/src/lib/jovy/__tests__/events.test.ts` | Visibilidad, bordes, gate de publicación, payloads de tipos, PUT parcial y orden determinista. |
| `apps/backend/src/lib/jovy/__tests__/brand-visibility.test.ts` | Ventanas cerradas, bordes exactos, concurrencia lógica y rechazo del quinto elemento. |
| `apps/backend/src/lib/jovy/__tests__/contacts.test.ts` y `audit.test.ts` | Esquema público, paginación 10/20/50, filtros SQL por texto y fecha, escape de `%`/`_`, CSV con límite/escaping y auditoría con whitelist (`create`, `status`, `note`, `delete`, `restore`, `update`). |
| `apps/backend/src/lib/jovy/__tests__/catalogue.test.ts`, `launches.test.ts`, `announcements.test.ts` y `product-editorial.test.ts` | Seed idempotente, `coming_soon ⇒ interaction_locked`, orden, color, reemplazo completo de mensajes, certificaciones y gate de publicación editorial. |
| `apps/backend/e2e/jovy-content.spec.ts` | Ciclo completo de página editorial: login, validación, alta, duplicado, edición, publicación, Store API, archivado, auditoría y borrado físico sin restore. |
| `apps/backend/e2e/jovy-hero.spec.ts` | Contratos HTTP y multimedia (PNG/JPEG/WebP y negativos), persistencia de media/ajustes globales, reordenamiento visible en Store y Product Link A→B→null idempotente con compensación. |
| `apps/backend/e2e/jovy-banners.spec.ts` | Slots, prioridad/orden, frecuencia, ventana UTC, `auto_open`, CTA y negativos `400`; edición, archivo y reordenamiento desde UI. |
| `apps/backend/e2e/jovy-events.spec.ts` | Publicación con gate, `title_en`, estados `cancelled`/futuro/pasado, tipos con GET/PUT/DELETE y bloqueo en uso, multimedia PNG/JPEG con reemplazo/retiro y reordenamiento restringido por prioridad. |
| `apps/backend/e2e/jovy-brand.spec.ts` | Galería con PNG real, publicación, edición, archivo, carga múltiple con confirmación, contador/cupo, lightbox, reorden con persistencia y borrado con confirmación; logo con familias, recorte visual, confirmaciones y desactivación pública. |
| `apps/backend/e2e/jovy-brand-families.spec.ts` | Vínculo logo ↔ familia canónica filtrado por categoría, `families_linked` y lectura Store. |
| `apps/backend/e2e/jovy-contacts.spec.ts` | Contacto público, validación, honeypot, sin lectura pública, búsqueda, seguimiento, auditoría sin PII y `429` con `Retry-After`. |
| `apps/backend/e2e/jovy-contact-inboxes.spec.ts` | Las cuatro entradas del sidebar con sus nombres exactos, tabla de seis columnas, filtros, tabs con counts, fechas, páginas 10/20/50, detalle/edición/auditoría, estado, notas, papelera, restauración, export CSV y polling. |
| `apps/backend/e2e/jovy-cms-navigation.spec.ts` | Entrada «JovyCandy CMS», tablero real con conteos, `401` sin sesión, navegación por tarjetas y ausencia de PII en la respuesta. |
| `apps/backend/e2e/jovy-catalogue-admin.spec.ts` | Edición de tarjetas, regla «Próximamente», imagen, reorden, vínculo comercial y ocultamiento en Store. |
| `apps/backend/e2e/jovy-launches-admin.spec.ts` | Producto, imagen, orden, visibilidad, color persistente y rechazo de hex inválido. |
| `apps/backend/e2e/jovy-announcements-admin.spec.ts` | Separación modal/mensaje, persistencia ES/EN, vaciado de un idioma y Store. |
| `apps/backend/e2e/jovy-novelties.spec.ts` | Video real con firma, persistencia, prioridad, activo, retiro y `media_type` en Store. |
| `apps/backend/e2e/jovy-product-editorial.spec.ts` | Ficha editorial: gramaje, certificaciones, novedad, orden, publicar/archivar y visibilidad Store. |
| `apps/backend/integration-tests/` | 11 suites / 76 pruebas HTTP (contactos Store/Admin/export/restore, contenido, marketing, eventos, catálogo, lanzamientos, anuncios y producto editorial) + `setup.js` para PostgreSQL de prueba. |

## Matriz de paridad

### 1. Productos y categorías

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| P1 | Catálogo editorial de productos no comerciales | `Implementada y validada` | `src/modules/jovy-product-editorial/models/product-editorial.ts`; workflow `src/workflows/jovy-product-editorial/editorial.ts`; API `api/admin/jovy/products/editorial/route.ts` y `.../[id]/editorial/route.ts`; widget `src/admin/widgets/product-editorial.tsx`; edición exclusiva vía widget `product.details` en el detalle nativo; agregado en `GET /admin/jovy/products/editorial`; Store `api/store/jovy/products/route.ts`; E2E `jovy-product-editorial.spec.ts`. | La ficha se identifica por `product_id` único y no copia título, SKU, precio, stock, variantes ni imágenes. `published_at` es set-once: se escribe en la transición a `published` y no se reescribe en cada guardado. El Store solo publica fichas `editorial_status = published` cuyo producto comercial siga `published` (`product_status`), y expone `product_status` para distinguir la causa. El widget agrupa la edición y pide confirmación en guardar, restaurar, publicar, archivar y eliminar. |
| P2 | Familia editorial de producto | `Implementada parcialmente` | `src/modules/jovy-catalogue/models/product-family.ts`; Module Link `src/links/product-family.ts`; derivación desde Product Categories en `src/scripts/sync-jovy-catalogue.ts`; visualización de solo lectura en `product-editorial.tsx:363`. | La relación canónica existe y el script valida «un producto ≤ 1 familia»: `planProductFamilyLinks` reporta conflicto y no reemplaza un vínculo existente. **No hay constraint de base de datos** para esa regla. **No hay pantalla ni endpoint de mutación del vínculo producto↔familia**: se deriva de la categoría comercial o del script. El CRUD de familias sí tiene API (`POST/PUT/DELETE /admin/jovy/catalogue/families`) y no tiene UI. |
| P3 | Gramaje | `Implementada y validada` | `models/product-editorial.ts:15`; schema `src/lib/jovy/product-editorial.ts`; input en el widget; E2E guarda `250 g`, recarga y lo verifica en Store. | Campo de texto opcional; no bloquea la publicación, igual que en el histórico. |
| P4 | Certificaciones | `Implementada y validada` | `src/lib/jovy/product-editorial.ts:21` (`PRODUCT_CERTIFICATIONS = SGS, OU Kosher, Halal`); `models/product-editorial.ts:16`; checkboxes del widget; E2E verifica SGS/OU Kosher marcadas y Halal sin marcar. | Catálogo cerrado de tres valores; no hay vigencia, badge ni documento adjunto. |
| P5 | Imágenes de producto | `Resuelta por Medusa nativo` | `docs/00:25`; módulo Product nativo de Medusa; no hay código CMS que duplique imágenes de producto. | El Admin nativo no está cubierto por E2E del repositorio. La ficha editorial solo exige que exista `thumbnail` para publicar. |
| P6 | Publicación de producto | `Resuelta por Medusa nativo` | `docs/00:25`; estado nativo de producto en Medusa; no hay estado comercial paralelo. | Además existe `editorial_status` (`draft`/`published`/`archived`) para la ficha CMS, validado por E2E. Son estados distintos: publicar la ficha no publica el producto comercial. |
| P7 | Orden editorial de productos | `Implementada y validada` | `models/product-editorial.ts:17`; orden por `sort_order` en la lista y en Store; E2E guarda `3` y lo verifica tras recargar y en `/store/jovy/products`. | `sort_order` convive con el orden nativo de Medusa; no lo reemplaza. |
| P8 | Restauración de productos | `Implementada parcialmente` | `api/admin/jovy/products/[id]/editorial/restore/route.ts`; botón «Restaurar ficha» en el widget. | Solo restaura la ficha editorial; no hay restauración del producto comercial. La ficha editorial y las solicitudes de contacto son los únicos registros CMS con restore expuesto; lanzamientos y familias conservan soft delete sin restore. El restore de ficha no tiene E2E propio. |
| P9 | Categorías | `Implementada y validada` | Product Categories nativas de Medusa + módulo `jovy_catalogue` (`jovy_catalogue_category`); UI `/app/jovy/catalogue`; E2E `jovy-catalogue-admin.spec.ts`; contrato en `docs/27`. | No son las mismas entidades: las Product Categories son taxonomía comercial nativa y las seis tarjetas (`sazonador`, `chamoy`, `gomitas_almidon`, `dulces_paletas`, `pinatero`, `gomitas_grenetina`) son presentación. `medusa_category_id` las enlaza. Sin alta ni borrado de tarjetas: claves fijas + seed idempotente. |
| P10 | Fuente de verdad comercial y no duplicación | `Resuelta por Medusa nativo` | `docs/00:44-56`; `src/links/product-hero-item.ts:5-11`; `src/links/product-family.ts`; los modelos CMS no contienen SKU, precio, variantes, stock ni pedidos. | El CMS solo enlaza producto por ID (Hero, lanzamientos, ficha editorial y familia). No se duplica información comercial. |

### 2. Hero y nuevos lanzamientos

El Hero histórico y la lista de «nuevos lanzamientos» eran dos capacidades distintas. El Hero se
conserva como carrusel de marketing; los lanzamientos ganaron módulo y pantalla propios.

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| H1 | Selección ordenada, activa y con estado | `Implementada y validada` | `models/hero-item.ts`; `workflows/jovy-marketing/reorder.ts`; UI `hero-manager.tsx`; E2E `jovy-hero.spec.ts` (reordenar y comprobar orden en Store). | Reordenamiento y visibilidad por estado cubiertos por E2E agrupada. |
| H2 | Texto bilingüe ES/EN | `Implementada y validada` | `models/hero-item.ts`; UI `hero-manager.tsx`; E2E `jovy-hero.spec.ts` crea con títulos ES/EN y la Store API devuelve ambas traducciones. | — |
| H3 | CTA | `Implementada parcialmente` | `lib/jovy/marketing.ts` (`safeCtaUrl`); UI `hero-manager.tsx`; unit de CTA inseguro; E2E rellena `/tienda` pero no asserta persistencia. | Falta assert de `cta_url` en Store; `cta_label` existe en schema/modelo, pero no hay input en UI. |
| H4 | Color por elemento | `Implementada parcialmente` | `models/hero-item.ts:16`; UI `hero-manager.tsx:248`. | Sin prueba E2E/unit de persistencia o render. |
| H5 | Imagen opcional | `Implementada y validada` | `models/hero-item.ts`; UI `hero-manager.tsx`; E2E `jovy-hero.spec.ts` sube PNG/JPEG/WebP reales y rechaza >5 MB, SVG, firma falsa, MIME incoherente, PNG corrupto y petición sin archivo. | Persistencia y previsualización cubiertas; el reemplazo de media se comparte con Eventos y Banners. |
| H6 | Configuración visual global | `Implementada y validada` | `models/hero-settings.ts`; `workflows/jovy-marketing/hero-settings.ts`; UI `hero-manager.tsx`; E2E `jovy-hero.spec.ts` cambia el color, recarga y verifica persistencia. | Solo existe color global; no hay más ajustes visuales. |
| H7 | Enlace editorial a producto Medusa | `Implementada y validada` | `links/product-hero-item.ts`; `workflows/jovy-marketing/set-hero-product.ts`; ruta `.../hero/[id]/product/route.ts`; E2E `jovy-hero.spec.ts` asigna A→B→null, comprueba idempotencia, `404` de producto inexistente y conserva B tras el fallo. | No duplica datos comerciales. La Store API aún no expone el producto (`docs/25`). |
| H8 | Programación y vigencia | `Implementada parcialmente` | `models/hero-item.ts:19-21`; `lib/jovy/marketing.ts:30-31,81-85`; UI `hero-manager.tsx:249`. | Sin E2E de fechas futuras/pasadas. |
| NL1 | Nuevos lanzamientos: producto, imagen, orden, activo y color global | `Implementada y validada` | `src/modules/jovy-launches/models/launch.ts` y `launch-settings.ts`; API `api/admin/jovy/launches/**` y `api/store/jovy/launches/route.ts`; UI `/app/jovy/launches`; E2E `jovy-launches-admin.spec.ts`; unit `launches.test.ts`; integración `launches.integration.test.ts`. | `active` es la única bandera de publicación; exige producto o imagen; el color global (`#00AFAA` por defecto) se valida como hex. No copia datos comerciales del producto. |

### 3. Promociones, banners y anuncios

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| PR1 | Slots `promo` / `hint` | `Implementada y validada` | `models/marketing-banner.ts`; UI `banner-manager.tsx`; Store `banners/[slot]/route.ts`; E2E `jovy-banners.spec.ts` cubre ambos slots y `404` para slot inválido. | — |
| PR2 | Activación y estado | `Implementada y validada` | `models/marketing-banner.ts`; UI; `isMarketingVisible`; E2E publica, edita, archiva y verifica desaparición en Store. | — |
| PR3 | Prioridad y orden | `Implementada y validada` | `models/marketing-banner.ts`; orden Store; E2E `jovy-banners.spec.ts` verifica `priority DESC`/`sort_order ASC` y que reordenar no cruza prioridad explícita. | — |
| PR4 | Frecuencia | `Implementada y validada` | `models/marketing-banner.ts`; schema `lib/jovy/marketing.ts`; unit `marketing.test.ts`; E2E publica `daily`/`session` y las devuelve en Store. | El storefront aún no interpreta la frecuencia; es decisión de presentación (`docs/25`). |
| PR5 | Ventana temporal | `Implementada y validada` | `models/marketing-banner.ts`; `lib/jovy/marketing.ts`; unit de bordes UTC; E2E con elementos futuros, expirados y edición de ventana. | — |
| PR6 | `auto_open` | `Implementada y validada` | `models/marketing-banner.ts`; UI; E2E crea con `auto_open: true` y lo verifica en Store. | El backend no abre nada; lo interpreta el frontend. |
| PR7 | CTA de banner | `Implementada y validada` | `lib/jovy/marketing.ts` (`safeCtaUrl`); UI; E2E verifica `https://` en Store y rechaza `javascript:` y `data:`. | — |
| AN1 | Anuncios de portada: banner promocional y bajo el logo + mensaje corporativo ES/EN | `Implementada y validada` | Banners: sin tabla nueva, reutiliza `jovy_marketing_banner` para `promo` y `hint` (PR1-PR7), ampliado con `rotation_seconds` 3–60 y `frequency` `once`. Mensaje: `models/announcement-settings.ts`; API `api/admin/jovy/announcements/settings/route.ts` y `api/store/jovy/announcements/settings/route.ts`; UI unificada `/app/jovy/announcements` con gestor embebido, filtro por tipo y presets; E2E `jovy-announcements-admin.spec.ts`; contrato en `docs/27` §3. | El histórico solo tenía el texto hardcodeado en i18n; el mensaje editable es nuevo y solicitado. `PUT` es reemplazo completo y `null` oculta el idioma. No se duplica formulario: ambos slots se administran en Anuncios; Marketing conserva Hero y solo enlaza. |

### 4. Eventos y novedades

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| E1 | Borrador / publicado / archivado | `Implementada y validada` | `models/event.ts`; `workflows/jovy-events/event.ts`; API `api/admin/jovy/events/[id]/route.ts`; UI `admin/routes/jovy/events/page.tsx`; E2E `jovy-events.spec.ts`. | Ciclo editorial validado. |
| E2 | Estado `cancelled` | `Implementada y validada` | `models/event.ts`; E2E `jovy-events.spec.ts` publica un evento vigente, lo pasa a `cancelled` y verifica que no aparece en Store. | `eventPublishIssues` impide publicar directamente como `cancelled`. |
| E3 | Tipo de evento en el evento | `Implementada y validada` | `models/event.ts`; schema `lib/jovy/events.ts`; UI select; E2E asigna un tipo real y publica; `404` si el tipo no existe. | — |
| E4 | Gestión de tipos de evento | `Implementada y validada` | `api/admin/jovy/events/types/route.ts` (GET/POST); `.../types/[id]/route.ts` (GET/PUT/DELETE); `workflows/jovy-events/event-type.ts`; UI crear/editar/eliminar; E2E cubre ciclo completo y bloqueo de borrado si está en uso. | El `code` tiene índice único parcial (`where deleted_at is null`), pero el `DELETE` es físico: la fila desaparece y el `code` queda libre de inmediato, sin restore. Falta prueba de concurrencia y decidir si esa reutilización es deseada. |
| E5 | Fechas de inicio y fin | `Implementada y validada` | `models/event.ts`; schema `lib/jovy/events.ts`; UI fecha/hora local; E2E con eventos vigente, futuro y pasado, y edición de ventana. | La conversión a UTC se hace una sola vez en Admin. |
| E6 | Prioridad | `Implementada y validada` | `models/event.ts`; orden Store; unit `events.test.ts`; E2E `jovy-events.spec.ts` verifica que la prioridad domina sobre `sort_order`. | — |
| E7 | Medio del evento: imagen, GIF o video | `Implementada y validada` | `models/event.ts` (`media_file_id`, `media_url`, `media_type`); `src/lib/jovy/events-media.ts` (firma GIF/MP4/WebM, límite 100 MB); UI de eventos y de Novedades; E2E `jovy-events.spec.ts` sube PNG, lo reemplaza por JPEG y lo retira; E2E `jovy-novelties.spec.ts` sube WebM real y verifica `media_type` en Store. | Reutiliza la ruta compartida de medios; no borra archivos. Sin `Range`/streaming: `file-local` sirve el video completo (`docs/27` §7). |
| E8 | Visibilidad Store de eventos | `Implementada y validada` | `api/store/jovy/events/route.ts`; E2E `jovy-events.spec.ts`. | Publicado y vigente aparece; archivado, cancelado, futuro, pasado y deshabilitado desaparecen. |
| E9 | Reordenamiento desde Admin | `Implementada y validada` | API/workflow `api/admin/jovy/events/reorder/route.ts`; `workflows/jovy-events/event.ts`; helper `admin/routes/jovy/events/ordering.ts`; UI con flechas deshabilitadas en el cruce de prioridad; E2E verifica orden en Store. | Reordenar solo cambia `sort_order` dentro del mismo grupo de prioridad. |
| E10 | Bandeja Novedades: multimedia, prioridad y activo | `Implementada y validada` | UI `/app/jovy/novelties` sobre `jovy_events`; `POST /admin/jovy/events/media/video`; E2E `jovy-novelties.spec.ts`. | Reutiliza la misma entidad histórica de eventos; no se creó tabla ni módulo de novedades. La creación y el borrado del evento siguen en Eventos Jovy. |

### 5. Galería Casa Jovy

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| G1 | Imagen de galería | `Implementada y validada` | `models/gallery-item.ts`; `workflows/jovy-brand/brand.ts`; UI `brand/page.tsx`; E2E `jovy-brand.spec.ts`. | E2E sube PNG real, publica y resuelve `media_url`. |
| G2 | Orden y reordenamiento | `Implementada y validada` | `models/gallery-item.ts`; `brand.ts`; UI `brand/page.tsx` y `components/gallery-manager.tsx`; E2E `jovy-brand.spec.ts` («Galería: orden con persistencia y eliminación con confirmación») | El E2E cancela la confirmación y verifica que el orden no cambia, luego confirma y comprueba persistencia y orden visual. |
| G3 | Borrado | `Implementada parcialmente` | `brand.ts` (`deleteBrandStep` → `deleteJovyGalleryItems`); UI `gallery-manager.tsx`; E2E de borrado con confirmación y desaparición de la lista. | Borrado **físico**, no lógico: la fila se elimina y no hay restore. El modelo DML declara `deleted_at`, pero la ruta no lo usa; no existe assert de soft delete porque no se implementó. |
| G4 | Límite de cuatro elementos visibles simultáneos | `Implementada y validada` | `lib/jovy/brand.ts` (`maxSimultaneousBrandItems`, `assertBrandVisibilityLimit`); `lib/jovy/brand-persistence.ts`; integración `src/modules/jovy-brand/__tests__/brand-persistence.integration.test.ts`; unit `src/lib/jovy/__tests__/brand-visibility.test.ts`; tope defensivo en `api/store/jovy/brand/gallery/route.ts`. | Regla nueva, no histórica. Concurrencia real con Locking Module PostgreSQL, ventanas solapadas/contiguas/disjuntas y bordes exactos cubiertos; el quinto también se rechaza por update. Sin E2E exclusiva, pero la lectura Store limita a cuatro con warning sin PII. |
| G5 | Ventana de programación | `Implementada parcialmente` | `models/gallery-item.ts:12-13`; migración `Migration20261113123000.ts:6-8`; UI `brand/page.tsx:262`. | Sin E2E de fechas. |

### 6. Logos

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| L1 | Logo por familia | `Implementada y validada` | `models/logo.ts`; `models/logo-family.ts` (`jovy_brand_logo_family`); Store filtra por `family` en `api/store/jovy/brand/logos/route.ts`; selector por categoría en la UI; E2E `jovy-brand-families.spec.ts`. | La familia ya no es texto libre: el logo se vincula a `jovy_product_family.id` con `family_ids` / `unmapped_families`. El array legado `families` se conserva por compatibilidad. |
| L2 | Orden y reordenamiento | `Implementada parcialmente` | `models/logo.ts:2`; `brand.ts:154-184`; UI `brand/page.tsx` y `components/logo-manager.tsx` (flechas + confirmación). | Sin E2E propio de reordenamiento de logos; el DnD contextual histórico no se replica. |
| L3 | Recorte no destructivo | `Implementada y validada` | `models/logo.ts:2`; `lib/jovy/brand-persistence.ts` (`persistLogoItem`); UI `logo-manager.tsx` (crop visual con pan/zoom/guía/reset); E2E `jovy-brand.spec.ts` (reset, cancelación y guardado de crop); integración `brand-persistence.integration.test.ts`. | Guarda metadatos `crop`, relee el valor y no escribe ni borra el archivo original. |
| L4 | Compatibilidad de familias legadas | `Implementada y validada` | `models/logo.ts` (`families`, `families_linked`); `resolveStoredLogoFamilies` en `api/admin/jovy/brand/logos/[id]/route.ts`; E2E `jovy-brand.spec.ts` (logo sin familias deja `families` nulo y `family_ids` vacío) y `jovy-brand-families.spec.ts`. | `families_linked` distingue «nunca vinculado» de «vinculación vacía»; no se inventan vínculos al leer un logo legado. |

### 7. Medios

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| M1 | Carga de imágenes | `Implementada y validada` | `api/admin/jovy/marketing/media/route.ts`; middleware multer; UI en Hero/Banner/Eventos/Marca; E2E `jovy-hero.spec.ts` cubre PNG/JPEG/WebP y rechaza >5 MB, SVG, firma falsa, MIME incoherente, PNG corrupto y petición sin archivo. | La validación es compartida; Eventos y Banners reutilizan la misma ruta. |
| M2 | Consulta de medios | `Implementada parcialmente` | `api/admin/jovy/marketing/media/[id]/route.ts:4-13`; usada por Hero `hero-manager.tsx:95` y Banner `banner-manager.tsx:84`. | Sin prueba dedicada. |
| M3 | Borrado de medios | `Pendiente` | Solo existe POST en `media/route.ts` y GET en `media/[id]/route.ts`; no hay DELETE. | No hay borrado físico ni conteo de referencias. `docs/23:58` lo declara pendiente por seguridad. |
| M4 | Recorte destructivo de archivos | `Descartada justificadamente` | `docs/13:38` descarta recorte de archivos; el recorte de logos es solo metadata (`models/logo.ts:2`). | Aceptable si el negocio acepta recorte no destructivo. |
| M5 | Video | `Implementada y validada` | `src/lib/jovy/events-media.ts` (`detectEventVideoMime`, `EVENT_VIDEO_MAX_BYTES = 100 MB`); ruta `api/admin/jovy/events/media/video/route.ts`; UI de Novedades; E2E `jovy-novelties.spec.ts` sube WebM real y verifica `media_type` en Store; unit `events-media.test.ts`. | El provider `file-local` no soporta `Range`, así que el video se sirve completo; no hay transcode ni borrado. |

### 8. Contactos

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| C1 | Recepción pública | `Implementada y validada` | `api/store/jovy/contacts/route.ts:7-19`; schema `lib/jovy/contacts.ts:6-17`; E2E `jovy-contacts.spec.ts:34-39`. | Devuelve 202 genérico. |
| C2 | Tipos de contacto | `Implementada y validada` | `models/contact-request.ts:13`; schema `contacts.ts:3,15`; UI `components/contact-inbox.tsx`; E2E `jovy-contact-inboxes.spec.ts` ejercita los cuatro tipos. | El enum cubre cuatro y cada bandeja fija su tipo; el servidor lo revalida. |
| C3 | Pendiente / atendido y `handled_by` | `Implementada y validada` | `models/contact-request.ts:15-17`; `workflows/jovy-contacts/contact.ts:44-49`; UI `contacts/page.tsx:67,93`; E2E `jovy-contacts.spec.ts:67-75`. | `handled_by` se toma del actor autenticado. |
| C4 | Filtros por estado, tipo y búsqueda | `Implementada y validada` | `api/admin/jovy/contacts/route.ts`; `lib/jovy/contacts.ts` (`contactListQuerySchema`, `contactListFilters`, `contactDate`); UI `contact-inbox-filters.tsx`; integración `contacts-query.integration.test.ts` (estado, tipo, texto, fechas, paginación 10/20/50, orden y escape de `%`/`_`); E2E `jovy-contact-inboxes.spec.ts` prueba tabs, búsqueda y fechas. | `q` busca en nombre, apellido, email, teléfono, ciudad, país, CP y tipo; `status` admite `pending`, `handled` y `deleted`; `date_from`/`date_to` aceptan ISO-8601; `limit` solo admite 10, 20 o 50. La paginación usa `take`/`skip` con orden `created_at DESC, id DESC`; el E2E no cubre el cambio de tamaño de página, la integración sí lo valida. |
| C5 | Exportación | `Implementada y validada` | `api/admin/jovy/contacts/export/route.ts`; `contactExportQuerySchema`, `toContactCsv`, `CONTACT_EXPORT_MAX_ROWS`, `contactExportFileName` en `lib/jovy/contacts.ts`; botón «Exportar CSV» en `contact-inbox.tsx`; E2E `jovy-contact-inboxes.spec.ts`; unit de CSV. | Exporta una sola bandeja (`contact_type` obligatorio), reutiliza filtros de estado, texto y fecha, limita a 5 000 filas, escapa fórmulas/comillas, usa UTF-8 con BOM y CRLF, `Content-Disposition` y `Cache-Control: no-store`. La auditoría va al logger con bandeja, filas, actor y filtros; nunca registra el término de búsqueda ni PII. |
| C6 | Borrado lógico y restauración | `Implementada y validada` | `workflows/jovy-contacts/contact.ts` (`deleteContactStep`, `restoreContactStep`); `POST /admin/jovy/contacts/:id/restore`; UI con pestaña Papelera y modal de detalle; integración `contacts-query.integration.test.ts` verifica que deja de listarse y que la fila existe con `deleted_at`; E2E ejercita borrado, papelera y restauración; migración `Migration20261114120000` amplía el check de auditoría con `restore` y `update`. | Restore idempotente: una solicitud viva vuelve sin cambios y no escribe auditoría. No hay purga física ni anonimización; la política está en `docs/26-RETENCION-CONTACTOS.md`. |
| C7 | Auditoría sin PII | `Implementada y validada` | `contact.ts:23-28,55-61`; E2E `jovy-contacts.spec.ts:76-79` verifica que el audit no contiene mensaje ni email. | Correcto. |
| C8 | Honeypot y rate limit | `Implementada y validada` | `lib/jovy/contact-rate-limit.ts:1-19`; `contacts/route.ts:10-15`; E2E `jovy-contacts.spec.ts:40-41,81-89`. | Rate limit en memoria; solo laboratorio de una instancia. |
| C9 | Notas administrativas | `Implementada y validada` | `contacts.ts:19-22`; `contact.ts:50-53`; UI `contacts/page.tsx:68,93`; E2E `jovy-contacts.spec.ts:68-70`. | Correcto. |
| C10 | Sin lectura pública de contactos | `Implementada y validada` | Solo POST en `api/store/jovy/contacts/route.ts:7`; E2E `jovy-contacts.spec.ts:33` obtiene 404/405. | Correcto. |
| C11 | Cuatro bandejas con la misma tabla | `Implementada y validada` | Rutas planas `admin/routes/jovy/contacts-{national-sales,international-sales,customer-service,catalogue}/page.tsx` que renderizan `<ContactInbox contactType=…>` sin redirects; vista consolidada `contacts/page.tsx`; componente compartido `contacts/components/contact-inbox.tsx`; `GET /admin/jovy/contacts/counts`; E2E `jovy-contact-inboxes.spec.ts` | Una sola tabla, un solo endpoint y una sola entrada de sidebar por bandeja. Las cuatro heredan tabs, búsqueda, fechas, páginas 10/20/50, papelera, restore, export y polling. Medusa 2.22.6 no pinta dos niveles de anidación en el sidebar, por eso la ruta es plana. |

### 9. Usuarios, roles y permisos

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| U1 | Login | `Resuelta por Medusa nativo` | E2E de login en `jovy-content.spec.ts:42-48`, `jovy-hero.spec.ts:9`, `jovy-events.spec.ts:18-22`, `jovy-brand.spec.ts:16-29`, `jovy-contacts.spec.ts:43-49`; auth nativa `api/middlewares.ts:13-16`. | Validado por E2E. |
| U2 | Gestión de usuarios | `Resuelta por Medusa nativo` | `docs/14:13`; Admin nativo de Medusa; no hay módulo propio de usuarios. | Invitar/editar/eliminar vive en Medusa Admin; no hay E2E del repositorio. |
| U3 | Bloqueo de usuarios | `Pendiente` | No hay ruta/modelo de bloqueo en `apps/backend/src`; la auditoría histórica lo menciona en `docs/13:24`. | El Admin nativo instalado no expone un flujo de bloqueo verificado; no se simuló. |
| U4 | Roles internos CMS/ventas y RBAC granular | `Pendiente` | `api/middlewares.ts:13-16` solo autentica; no hay middleware de permisos; `docs/19-SEGURIDAD-ADMIN.md` §3 documenta el gap, el diseño y la licencia. | Bloqueado por decisión comercial/licencia: `@medusajs/rbac` es Enterprise y no está licenciado ni registrado. Cualquier usuario Medusa autenticado accede a todos los `/admin/jovy/*`. No se simulan roles. |

### 10. Analítica y SSE

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| A1 | Page views, eventos y métricas de dashboard | `Descartada justificadamente` | `docs/13:25`; `docs/14:14`; sin código de analytics en `apps/backend/src`; UI `dashboard-analytics.tsx` declara «No disponible: falta fuente analítica». | No se reconstruye hasta definir fuente aprobada y privacidad. Los rangos 7/30/90/personalizado existen en la UI, pero no alteran conteos ni inventan cifras. |
| S1 | SSE / sincronización admin-web | `Descartada justificadamente` | `docs/13:26`; `docs/14:14`; sin rutas SSE ni `EventSource` en el CMS. | Se sustituirá por revalidación cuando exista storefront consumidor. |

### 11. Reglas transversales y configuración

| ID | Funcionalidad histórica / regla | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| T1 | Borradores y archivados nunca públicos | `Implementada y validada` | Content `store/jovy/content/pages/[slug]/route.ts`; Events `store/jovy/events/route.ts`; Hero `store/jovy/marketing/hero/route.ts`; Banner `banners/[slot]/route.ts`; Marca `store/jovy/brand/gallery/route.ts`; E2E content, events, hero, banners y brand. | Cubierto también en Banners con E2E y unit de visibilidad. |
| T2 | Auditoría de actor, acción, entidad y fecha | `Implementada parcialmente` | Workflows de todos los módulos; E2E content `jovy-content.spec.ts:107-126`; contactos `jovy-contacts.spec.ts:76-79`. | No hay pruebas de auditoría para Hero, Banner, Eventos ni Marca. |
| T3 | Borrado lógico de contenido editorial | `Implementada parcialmente` | Contactos (`softDeleteJovyContactRequests`), lanzamientos (`softDeleteLaunches`), familias de catálogo (`softDeleteProductFamilies`), ficha editorial (`softDeleteProductEditorials`) y eventos (`softDeleteJovyEvents`) usan soft delete; integración `contacts-query.integration.test.ts` verifica `deleted_at`; E2E de contactos cubre papelera y restore. | No es uniforme: páginas editoriales, Hero, banners, galería, logos y tipos de evento se borran físicamente con `delete*`. Eventos usa soft delete desde el fix de backend, sin restore expuesto. Solo contactos y ficha editorial exponen restore. |
| T4 | Restauración tras borrado lógico en CMS | `Implementada parcialmente` | Existen `POST /admin/jovy/products/[id]/editorial/restore`, `POST /admin/jovy/contacts/:id/restore` y la pestaña Papelera. Lanzamientos y familias de catálogo tienen soft delete **sin** restore expuesto. Páginas, Hero, banners, galería, logos y tipos de evento no tienen restore porque su borrado es físico. | Cubre la ficha editorial y las solicitudes de contacto. El restore de contactos es idempotente y auditado; el de ficha no tiene E2E propio. El registro de evento queda soft-deleted tras el fix de backend, pero su restore no está expuesto. |
| T5 | Configuración corporativa general | `Pendiente` | Existen color global de Hero (`models/hero-settings.ts:3-6`) y mensaje corporativo ES/EN (`jovy_announcement_settings`); no hay modelo/ruta/UI de identidad, footer, redes o certificados globales. | El mensaje corporativo es nuevo y cubre solo el texto de portada; no equivale a configuración corporativa completa. |
| T6 | Políticas de tienda por región | `Resuelta por Medusa nativo` | `lib/region-store-policies.ts:6-24`; seed `migration-scripts/region-store-policies.ts:6-31`; metadata nativa de región. | Envío/devoluciones viven en metadata de región; se editan en Settings → Regions → Metadata. Sin prueba propia. |

## Resumen de conteos

| Clasificación | Total |
| --- | ---: |
| `Implementada y validada` | 49 |
| `Implementada parcialmente` | 12 |
| `Resuelta por Medusa nativo` | 6 |
| `Pendiente` | 4 |
| `Descartada justificadamente` | 3 |
| **Total de filas históricas/transversales** | **74** |

Los 74 juicios son **funcionalidades**; `docs/28` los agrupa en 13 pantallas. El total se mantiene
en 74: esta revisión no agregó ni eliminó filas. Reclasificó `C5` (exportación, de pendiente a
validada), `G2` (reorden de galería, de parcial a validada) y `T3` (borrado editorial, de validada a
parcial porque el borrado no es lógico en todas las entidades), amplió `C6` con restauración y
actualizó la evidencia de las áreas tocadas (categorías, logos, productos, lanzamientos, anuncios,
novedades, dashboard, contactos).

### Conteo por módulo

| Módulo | Validada | Parcial | Nativo | Pendiente | Descartada | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Productos y categorías | 5 | 2 | 3 | 0 | 0 | 10 |
| Hero y lanzamientos | 6 | 3 | 0 | 0 | 0 | 9 |
| Promociones, banners y anuncios | 8 | 0 | 0 | 0 | 0 | 8 |
| Eventos y novedades | 10 | 0 | 0 | 0 | 0 | 10 |
| Galería Casa Jovy | 3 | 2 | 0 | 0 | 0 | 5 |
| Logos | 3 | 1 | 0 | 0 | 0 | 4 |
| Medios | 2 | 1 | 0 | 1 | 1 | 5 |
| Contactos | 11 | 0 | 0 | 0 | 0 | 11 |
| Usuarios/roles | 0 | 0 | 2 | 2 | 0 | 4 |
| Analítica/SSE | 0 | 0 | 0 | 0 | 2 | 2 |
| Transversales/configuración | 1 | 3 | 1 | 1 | 0 | 6 |
| **Total** | **49** | **12** | **6** | **4** | **3** | **74** |

## Brechas que bloquean paridad real

1. **Producto editorial: brecha residual, no ausencia.** El módulo, la ficha, el gate de publicación y la restauración de ficha ya existen y están validados por E2E. Falta la **asignación manual producto ↔ familia** desde Admin (la API de familias existe, la pantalla solo lista), la restauración del producto comercial y la auditoría de los módulos nuevos.
2. **RBAC bloqueado por licencia.** `@medusajs/rbac` es Enterprise y no está licenciado ni registrado. `authorize`/`hasPermission` son no-op y cualquier usuario autenticado es admin pleno. No es un pendiente de código: requiere decisión comercial. (`docs/19`.)
3. **Ciclo de vida de medios incompleto.** Carga de imágenes y video validada (firma, MIME, 5 MB imagen / 100 MB video), pero no hay borrado de archivos, conteo de referencias, transcode ni streaming por rangos con el provider `file-local`.
4. **Retención y rate limit de contactos.** La exportación CSV y la restauración ya existen y están validadas; faltan purga física/anonimización automática y un rate limit compartido. El actual es en memoria y solo cubre una instancia.
5. **Configuración corporativa y SEO incompletos.** El mensaje corporativo ES/EN ya es editable, pero no hay configuración estructurada de identidad, footer, redes o certificados globales; la UI de páginas no expone SEO ni `published_at`.
6. **Cobertura E2E desigual.** Hay 14 specs / 27 pruebas, pero siguen sin E2E: reordenamiento de Logos, CTA/color/ventana del Hero, auditoría de Hero/Banner/Eventos/Marca, restore de ficha editorial y el Admin nativo (productos, categorías, usuarios, pedidos). El límite de cuatro de Galería está cubierto por integración y E2E de cupo.
7. **Restauración limitada.** Solo la ficha editorial de producto y las solicitudes de contacto tienen restore. Lanzamientos y familias de catálogo tienen soft delete sin restore expuesto. Páginas editoriales, Hero, banners, galería, logos y tipos de evento tienen borrado físico sin restore. Eventos usa soft delete desde el fix de backend, sin restore expuesto.

## Brechas aceptables de laboratorio

- File Module local con archivos públicos; no apto para material sensible (`docs/23:50`). El video se sirve completo porque no hay soporte de `Range`.
- Rate limit de contactos en memoria; aceptable para una instancia local, no para producción.
- Recorte de logos como metadata no destructiva; no hay recorte de píxeles.
- Analítica y SSE diferidos por decisión explícita.
- Medusa nativo cubre producto, categorías comerciales, imágenes de producto, usuarios y políticas de región; no todo tiene E2E del repositorio.
- El CMS no duplica SKU, precio, variantes, stock ni pedidos; Hero, lanzamientos y ficha editorial enlazan producto por ID.
- Las familias de logos ya son canónicas (`jovy_brand_logo_family`); el array legado `families` se mantiene solo por compatibilidad y no se usa para filtrar en Store.

## Anexo: capacidades nuevas no exigidas por la auditoría histórica

Estas filas no se incluyeron en los totales de paridad.

| Capacidad nueva | Clasificación | Evidencia | Observación |
| --- | --- | --- | --- |
| Páginas editoriales bilingües con ciclo de vida | `Implementada y validada` | `models/editorial-page.ts:15-32`; E2E `jovy-content.spec.ts:34-127`. | Nueva respecto del administrador histórico. |
| SEO por página | `Implementada parcialmente` | Modelo `editorial-page.ts:9-13,21`; schema `lib/jovy/editorial-page.ts:16-32`; API acepta `seo`; UI `admin/routes/jovy/content/page.tsx:179-205` no expone campos SEO. | API/modelo listos; falta UI. |
| Programación de publicación de páginas | `Implementada parcialmente` | Modelo `editorial-page.ts:22`; schema `editorial-page.ts:39,50-63`; UI Content no expone `published_at`. | E2E no prueba fecha futura. |
| Store API de contenido publicado | `Implementada y validada` | `api/store/jovy/content/pages/[slug]/route.ts:5-22`; E2E `jovy-content.spec.ts:92-105`. | Requiere Publishable API Key nativa. |
| Límite de cuatro elementos de galería | `Implementada y validada` | `lib/jovy/brand.ts`; `lib/jovy/brand-persistence.ts`; `src/modules/jovy-brand/__tests__/brand-persistence.integration.test.ts`; `src/lib/jovy/__tests__/brand-visibility.test.ts`. | Concurrencia, ventanas contiguas y bordes exactos probados; la lectura Store aplica un tope defensivo de cuatro. |
| Dashboard del CMS y navegación agrupada bajo «JovyCandy CMS» | `Implementada y validada` | `admin/routes/jovy/page.tsx` y `components/dashboard-*`; `GET /admin/jovy/dashboard`; E2E `jovy-cms-navigation.spec.ts`. | Tablero nuevo con H1 «Dashboard», marca «JovyCandy CMS», KPIs 1/3, rangos 7/30/90/personalizado, refresco de 60 s pausado en pestaña oculta, conteos reales y `401` sin sesión; no incluye analítica web (ver fila 1 y `docs/29`). |
| Vista consolidada de contactos | `Implementada y validada` | `admin/routes/jovy/contacts/page.tsx`; E2E `jovy-contact-inboxes.spec.ts` (cuatro filas y búsqueda compartida). | Sustituye el enlace histórico de «Solicitudes» sin duplicar tablas ni endpoints. |
| Exportación CSV y restauración de solicitudes | `Implementada y validada` | `api/admin/jovy/contacts/export/route.ts`; `api/admin/jovy/contacts/[id]/restore/route.ts`; `lib/jovy/contacts.ts`; migración `Migration20261114120000`; E2E de bandejas. | Nueva respecto de la ola anterior; cubre la brecha histórica de exportación y el ciclo de papelera. |
