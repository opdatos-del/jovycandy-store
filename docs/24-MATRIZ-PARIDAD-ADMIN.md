# Matriz de paridad — administrador histórico vs CMS Medusa

**Estado:** auditoría documental sobre el árbol de trabajo. Esta actualización solo edita documentación: no modifica `apps/**`, no toca proyectos históricos y no hace commits.

**Fecha de corte:** 2026-11-13.

**Fuentes principales:** `docs/13-AUDITORIA-ADMIN-ORIGINAL.md`, `docs/14-MAPEO-ADMIN-MEDUSA.md`, `docs/21-ESTADO-REESCRITURA-ADMIN.md`, `docs/23-MARKETING-CONTENT.md`, `docs/25-CONTRATOS-STOREFRONT.md`, código de `apps/backend` y specs E2E/unitarias/integración.

**Nota metodológica:** esta matriz se contrastó contra el código y las pruebas del árbol de trabajo al 2026-11-13. `docs/17-APIS-CMS.md` es la fuente de verdad del inventario de APIs y está sincronizado con el código; `docs/16` y `docs/20` no se usan como evidencia. La regresión agrupada de Playwright quedó estable tras corregir el watcher de `medusa develop` (ver `docs/21`); las seis specs E2E (`content`, `hero`, `banners`, `events`, `brand`, `contacts`) corren con `workers: 1`.

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
| `pnpm --dir apps/backend test:unit` | 15 suites / 95 pruebas: reglas de publicación, esquemas, orden, auditoría sin PII, rate limit, paginación/filtros y contratos de rutas. |
| `pnpm --dir apps/backend test:integration:modules` | 3 suites / 16 pruebas con PostgreSQL real: límite concurrente de cuatro en Galería, crop no destructivo, medios compartidos, `media_file_id` inexistente, paginación/filtros/soft delete de contactos y visibilidad editorial. |
| `apps/backend/src/lib/jovy/__tests__/marketing.test.ts` | Visibilidad, bordes UTC, CTA seguro, payloads de banner, frecuencia, reordenamiento y orden determinista. |
| `apps/backend/src/lib/jovy/__tests__/events.test.ts` | Visibilidad, bordes, gate de publicación, payloads de tipos, PUT parcial y orden determinista. |
| `apps/backend/src/lib/jovy/__tests__/brand-visibility.test.ts` | Ventanas cerradas, bordes exactos, concurrencia lógica y rechazo del quinto elemento. |
| `apps/backend/src/lib/jovy/__tests__/contacts.test.ts` y `audit.test.ts` | Esquema público, paginación, filtros SQL, escape de `%`/`_` y auditoría con whitelist. |
| `apps/backend/e2e/jovy-content.spec.ts` | Ciclo completo de página editorial: login, validación, alta, duplicado, edición, publicación, Store API, archivado, auditoría y borrado lógico. |
| `apps/backend/e2e/jovy-hero.spec.ts` | Contratos HTTP y multimedia (PNG/JPEG/WebP y negativos), persistencia de media/ajustes globales, reordenamiento visible en Store y Product Link A→B→null idempotente con compensación. |
| `apps/backend/e2e/jovy-banners.spec.ts` | Slots, prioridad/orden, frecuencia, ventana UTC, `auto_open`, CTA y negativos `400`; edición, archivo y reordenamiento desde UI. |
| `apps/backend/e2e/jovy-events.spec.ts` | Publicación con gate, `title_en`, estados `cancelled`/futuro/pasado, tipos con GET/PUT/DELETE y bloqueo en uso, multimedia PNG/JPEG con reemplazo/retiro y reordenamiento restringido por prioridad. |
| `apps/backend/e2e/jovy-brand.spec.ts` | Galería con PNG real, publicación, edición, archivo; logo con familia, recorte no destructivo y desactivación pública. |
| `apps/backend/e2e/jovy-contacts.spec.ts` | Contacto público, validación, honeypot, sin lectura pública, búsqueda, seguimiento, auditoría sin PII y `429` con `Retry-After`. |
| `apps/backend/integration-tests/` | 5 suites / 19 pruebas HTTP (contactos, contenido, marketing) + `setup.js` para PostgreSQL de prueba. |

## Matriz de paridad

### 1. Productos y categorías

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| P1 | Catálogo editorial de productos no comerciales | `Pendiente` | `docs/13-AUDITORIA-ADMIN-ORIGINAL.md:16`; `medusa-config.ts:16-58` no registra módulo de producto editorial; `docs/18-MEDUSA-ADMIN-EXTENSIONES.md:11` dice que los widgets de producto están planeados. | No hay modelo, migración, API, workflow ni UI editorial de producto. Medusa cubre producto comercial, no atributos editoriales. |
| P2 | Familia editorial de producto | `Pendiente` | Solo existe `families` para logos en `apps/backend/src/modules/jovy-brand/models/logo.ts:2`; no hay modelo/campo de familia de producto. | No confundir familia de logo con familia canónica de producto. No hay vínculo ni validación contra una taxonomía de producto. |
| P3 | Gramaje | `Pendiente` | Sin modelos, rutas ni UI en `apps/backend/src`; `docs/13:16` lo enumera como atributo histórico. | No existe campo editorial de gramaje. El `weight` de `seed-demo-products.ts:293` es peso comercial de variante, no gramaje editorial. |
| P4 | Certificaciones | `Pendiente` | Sin modelo, migración, ruta ni UI; `docs/00-PLAN-MAESTRO.md:15` menciona materiales de certificación solo como assets de referencia. | No hay catálogo de certificaciones, badges, vigencia ni asociación a producto. |
| P5 | Imágenes de producto | `Resuelta por Medusa nativo` | `docs/00:25`; módulo Product nativo de Medusa; no hay código CMS que duplique imágenes de producto. | El Admin nativo no está cubierto por E2E del repositorio. |
| P6 | Publicación de producto | `Resuelta por Medusa nativo` | `docs/00:25`; estado nativo de producto en Medusa; no hay estado editorial paralelo. | Sin E2E propio; se acepta como capacidad nativa. |
| P7 | Orden editorial de productos | `Pendiente` | Sin `sort_order` de producto en el CMS; `docs/13:16` lo menciona. | Medusa no ofrece orden editorial de productos por defecto. No hay metadata/orden implementado. |
| P8 | Restauración de productos | `Pendiente` | No hay workflow ni ruta de restauración en `apps/backend/src/workflows` ni `src/api`; `docs/13:16` lo menciona. | Solo existen workflows de borrado en módulos CMS, no restauración. No se verificó restauración nativa de producto. |
| P9 | Categorías | `Resuelta por Medusa nativo` | `docs/00:25`; módulo Product nativo; no hay módulo de categorías editoriales paralelo. | Sin E2E propio. |
| P10 | Fuente de verdad comercial y no duplicación | `Resuelta por Medusa nativo` | `docs/00:44-56`; `apps/backend/src/links/product-hero-item.ts:5-11`; los modelos CMS no contienen SKU, precio, variantes, stock ni pedidos. | El CMS solo enlaza producto por ID. No se duplica información comercial. |

### 2. Hero / nuevos lanzamientos

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

### 3. Promociones / banners

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| PR1 | Slots `promo` / `hint` | `Implementada y validada` | `models/marketing-banner.ts`; UI `banner-manager.tsx`; Store `banners/[slot]/route.ts`; E2E `jovy-banners.spec.ts` cubre ambos slots y `404` para slot inválido. | — |
| PR2 | Activación y estado | `Implementada y validada` | `models/marketing-banner.ts`; UI; `isMarketingVisible`; E2E publica, edita, archiva y verifica desaparición en Store. | — |
| PR3 | Prioridad y orden | `Implementada y validada` | `models/marketing-banner.ts`; orden Store; E2E `jovy-banners.spec.ts` verifica `priority DESC`/`sort_order ASC` y que reordenar no cruza prioridad explícita. | — |
| PR4 | Frecuencia | `Implementada y validada` | `models/marketing-banner.ts`; schema `lib/jovy/marketing.ts`; unit `marketing.test.ts`; E2E publica `daily`/`session` y las devuelve en Store. | El storefront aún no interpreta la frecuencia; es decisión de presentación (`docs/25`). |
| PR5 | Ventana temporal | `Implementada y validada` | `models/marketing-banner.ts`; `lib/jovy/marketing.ts`; unit de bordes UTC; E2E con elementos futuros, expirados y edición de ventana. | — |
| PR6 | `auto_open` | `Implementada y validada` | `models/marketing-banner.ts`; UI; E2E crea con `auto_open: true` y lo verifica en Store. | El backend no abre nada; lo interpreta el frontend. |
| PR7 | CTA de banner | `Implementada y validada` | `lib/jovy/marketing.ts` (`safeCtaUrl`); UI; E2E verifica `https://` en Store y rechaza `javascript:` y `data:`. | — |

### 4. Eventos

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| E1 | Borrador / publicado / archivado | `Implementada y validada` | `models/event.ts`; `workflows/jovy-events/event.ts`; API `api/admin/jovy/events/[id]/route.ts`; UI `admin/routes/jovy/events/page.tsx`; E2E `jovy-events.spec.ts`. | Ciclo editorial validado. |
| E2 | Estado `cancelled` | `Implementada y validada` | `models/event.ts`; E2E `jovy-events.spec.ts` publica un evento vigente, lo pasa a `cancelled` y verifica que no aparece en Store. | `eventPublishIssues` impide publicar directamente como `cancelled`. |
| E3 | Tipo de evento en el evento | `Implementada y validada` | `models/event.ts`; schema `lib/jovy/events.ts`; UI select; E2E asigna un tipo real y publica; `404` si el tipo no existe. | — |
| E4 | Gestión de tipos de evento | `Implementada y validada` | `api/admin/jovy/events/types/route.ts` (GET/POST); `.../types/[id]/route.ts` (GET/PUT/DELETE); `workflows/jovy-events/event-type.ts`; UI crear/editar/eliminar; E2E cubre ciclo completo y bloqueo de borrado si está en uso. | El `code` tiene índice único parcial (`where deleted_at is null`); falta prueba de concurrencia y decidir la reutilización tras borrado lógico. |
| E5 | Fechas de inicio y fin | `Implementada y validada` | `models/event.ts`; schema `lib/jovy/events.ts`; UI fecha/hora local; E2E con eventos vigente, futuro y pasado, y edición de ventana. | La conversión a UTC se hace una sola vez en Admin. |
| E6 | Prioridad | `Implementada y validada` | `models/event.ts`; orden Store; unit `events.test.ts`; E2E `jovy-events.spec.ts` verifica que la prioridad domina sobre `sort_order`. | — |
| E7 | Medio / imagen del evento | `Implementada y validada` | `models/event.ts`; UI upload/retiro; E2E sube PNG, lo reemplaza por JPEG, verifica `media_url` distinta y lo retira hasta `null`. | Reutiliza la ruta compartida de medios; no borra archivos. |
| E8 | Visibilidad Store de eventos | `Implementada y validada` | `api/store/jovy/events/route.ts`; E2E `jovy-events.spec.ts`. | Publicado y vigente aparece; archivado, cancelado, futuro, pasado y deshabilitado desaparecen. |
| E9 | Reordenamiento desde Admin | `Implementada y validada` | API/workflow `api/admin/jovy/events/reorder/route.ts`; `workflows/jovy-events/event.ts`; helper `admin/routes/jovy/events/ordering.ts`; UI con flechas deshabilitadas en el cruce de prioridad; E2E verifica orden en Store. | Reordenar solo cambia `sort_order` dentro del mismo grupo de prioridad. |

### 5. Galería Casa Jovy

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| G1 | Imagen de galería | `Implementada y validada` | `models/gallery-item.ts`; `workflows/jovy-brand/brand.ts`; UI `brand/page.tsx`; E2E `jovy-brand.spec.ts`. | E2E sube PNG real, publica y resuelve `media_url`. |
| G2 | Orden y reordenamiento | `Implementada parcialmente` | `models/gallery-item.ts`; `brand.ts`; UI `brand/page.tsx`. | Sin E2E de reordenamiento. |
| G3 | Soft delete | `Implementada parcialmente` | `brand.ts`; UI `brand/page.tsx`; modelo DML con `deleted_at`. | El E2E solo usa DELETE para limpieza, no asserta soft delete ni desaparición. |
| G4 | Límite de cuatro elementos visibles simultáneos | `Implementada y validada` | `lib/jovy/brand.ts` (`maxSimultaneousBrandItems`, `assertBrandVisibilityLimit`); `lib/jovy/brand-persistence.ts`; integración `src/modules/jovy-brand/__tests__/brand-persistence.integration.test.ts`; unit `src/lib/jovy/__tests__/brand-visibility.test.ts`; tope defensivo en `api/store/jovy/brand/gallery/route.ts`. | Regla nueva, no histórica. Concurrencia real con Locking Module PostgreSQL, ventanas solapadas/contiguas/disjuntas y bordes exactos cubiertos; el quinto también se rechaza por update. Sin E2E exclusiva, pero la lectura Store limita a cuatro con warning sin PII. |
| G5 | Ventana de programación | `Implementada parcialmente` | `models/gallery-item.ts:12-13`; migración `Migration20261113123000.ts:6-8`; UI `brand/page.tsx:262`. | Sin E2E de fechas. |

### 6. Logos

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| L1 | Logo por familia | `Implementada y validada` | `models/logo.ts`; Store filtra por `family` en `api/store/jovy/brand/logos/route.ts`; UI `brand/page.tsx`; E2E `jovy-brand.spec.ts`. | Familias son texto libre; no hay vínculo canónico con familia de producto. |
| L2 | Orden y reordenamiento | `Implementada parcialmente` | `models/logo.ts:2`; `brand.ts:154-184`; UI `brand/page.tsx:267`. | Sin E2E de reordenamiento. |
| L3 | Recorte no destructivo | `Implementada y validada` | `models/logo.ts:2`; `lib/jovy/brand-persistence.ts` (`persistLogoItem`); UI `brand/page.tsx:273-274`; E2E `jovy-brand.spec.ts:114-121`; integración `brand-persistence.integration.test.ts`. | Guarda metadatos `crop`, relee el valor y no escribe ni borra el archivo original. |

### 7. Medios

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| M1 | Carga de imágenes | `Implementada y validada` | `api/admin/jovy/marketing/media/route.ts`; middleware multer; UI en Hero/Banner/Eventos/Marca; E2E `jovy-hero.spec.ts` cubre PNG/JPEG/WebP y rechaza >5 MB, SVG, firma falsa, MIME incoherente, PNG corrupto y petición sin archivo. | La validación es compartida; Eventos y Banners reutilizan la misma ruta. |
| M2 | Consulta de medios | `Implementada parcialmente` | `api/admin/jovy/marketing/media/[id]/route.ts:4-13`; usada por Hero `hero-manager.tsx:95` y Banner `banner-manager.tsx:84`. | Sin prueba dedicada. |
| M3 | Borrado de medios | `Pendiente` | Solo existe POST en `media/route.ts` y GET en `media/[id]/route.ts`; no hay DELETE. | No hay borrado físico ni conteo de referencias. `docs/23:58` lo declara pendiente por seguridad. |
| M4 | Recorte destructivo de archivos | `Descartada justificadamente` | `docs/13:38` descarta recorte de archivos; el recorte de logos es solo metadata (`models/logo.ts:2`). | Aceptable si el negocio acepta recorte no destructivo. |
| M5 | Video | `Pendiente` | `media/route.ts:10-15,24` solo detecta PNG/JPEG/WebP; no hay MIME, ruta ni UI de video. | La auditoría histórica menciona imágenes y videos (`docs/13:22`). |

### 8. Contactos

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| C1 | Recepción pública | `Implementada y validada` | `api/store/jovy/contacts/route.ts:7-19`; schema `lib/jovy/contacts.ts:6-17`; E2E `jovy-contacts.spec.ts:34-39`. | Devuelve 202 genérico. |
| C2 | Tipos de contacto | `Implementada y validada` | `models/contact-request.ts:13`; schema `contacts.ts:3,15`; UI `contacts/page.tsx:91`; E2E usa `customer-service`. | Solo un tipo ejercitado en E2E; el enum cubre cuatro. |
| C3 | Pendiente / atendido y `handled_by` | `Implementada y validada` | `models/contact-request.ts:15-17`; `workflows/jovy-contacts/contact.ts:44-49`; UI `contacts/page.tsx:67,93`; E2E `jovy-contacts.spec.ts:67-75`. | `handled_by` se toma del actor autenticado. |
| C4 | Filtros por estado, tipo y búsqueda | `Implementada y validada` | `api/admin/jovy/contacts/route.ts`; `lib/jovy/contacts.ts` (`contactListQuerySchema`, `contactListFilters`); UI `contacts/page.tsx`; integración `contacts-query.integration.test.ts` (estado, tipo, búsqueda sin distinguir mayúsculas y escape de `%`/`_`); E2E prueba `q`. | Pagina con `take`/`skip` (máximo 100) y filtra en SQL; el E2E no cubre estado/tipo, la integración sí. |
| C5 | Exportación | `Pendiente` | No hay ruta de exportación en `api/admin/jovy/contacts/`; no hay CSV/Content-Disposition. | La auditoría histórica la incluye (`docs/13:23`). |
| C6 | Borrado lógico | `Implementada y validada` | `workflows/jovy-contacts/contact.ts` (`softDeleteJovyContactRequests`); UI `contacts/page.tsx`; integración `contacts-query.integration.test.ts` verifica que deja de listarse y que la fila existe con `deleted_at`; E2E usa DELETE para limpieza. | No hay restauración ni purga física/anonimización; la política está en `docs/26-RETENCION-CONTACTOS.md`. |
| C7 | Auditoría sin PII | `Implementada y validada` | `contact.ts:23-28,55-61`; E2E `jovy-contacts.spec.ts:76-79` verifica que el audit no contiene mensaje ni email. | Correcto. |
| C8 | Honeypot y rate limit | `Implementada y validada` | `lib/jovy/contact-rate-limit.ts:1-19`; `contacts/route.ts:10-15`; E2E `jovy-contacts.spec.ts:40-41,81-89`. | Rate limit en memoria; solo laboratorio de una instancia. |
| C9 | Notas administrativas | `Implementada y validada` | `contacts.ts:19-22`; `contact.ts:50-53`; UI `contacts/page.tsx:68,93`; E2E `jovy-contacts.spec.ts:68-70`. | Correcto. |
| C10 | Sin lectura pública de contactos | `Implementada y validada` | Solo POST en `api/store/jovy/contacts/route.ts:7`; E2E `jovy-contacts.spec.ts:33` obtiene 404/405. | Correcto. |

### 9. Usuarios, roles y permisos

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| U1 | Login | `Resuelta por Medusa nativo` | E2E de login en `jovy-content.spec.ts:42-48`, `jovy-hero.spec.ts:9`, `jovy-events.spec.ts:18-22`, `jovy-brand.spec.ts:16-29`, `jovy-contacts.spec.ts:43-49`; auth nativa `api/middlewares.ts:13-16`. | Validado por E2E. |
| U2 | Gestión de usuarios | `Resuelta por Medusa nativo` | `docs/14:13`; Admin nativo de Medusa; no hay módulo propio de usuarios. | Invitar/editar/eliminar vive en Medusa Admin; no hay E2E del repositorio. |
| U3 | Bloqueo de usuarios | `Pendiente` | No hay ruta/modelo de bloqueo en `apps/backend/src`; la auditoría histórica lo menciona en `docs/13:24`. | El Admin nativo instalado no expone un flujo de bloqueo verificado; no se simuló. |
| U4 | Roles internos CMS/ventas y RBAC granular | `Pendiente` | `api/middlewares.ts:13-16` solo autentica; no hay middleware de permisos; `docs/19-SEGURIDAD-ADMIN.md` §3 documenta el gap y el diseño. | Cualquier usuario Medusa autenticado accede a todos los `/admin/jovy/*`. No hay RBAC propio ni módulo RBAC configurado. |

### 10. Analítica y SSE

| ID | Funcionalidad histórica | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| A1 | Page views, eventos y métricas de dashboard | `Descartada justificadamente` | `docs/13:25`; `docs/14:14`; sin código de analytics en `apps/backend/src`. | No se reconstruye hasta definir fuente aprobada y privacidad. |
| S1 | SSE / sincronización admin-web | `Descartada justificadamente` | `docs/13:26`; `docs/14:14`; sin rutas SSE ni `EventSource` en el CMS. | Se sustituirá por revalidación cuando exista storefront consumidor. |

### 11. Reglas transversales y configuración

| ID | Funcionalidad histórica / regla | Clasificación | Evidencia | Observación / brecha |
| --- | --- | --- | --- | --- |
| T1 | Borradores y archivados nunca públicos | `Implementada y validada` | Content `store/jovy/content/pages/[slug]/route.ts`; Events `store/jovy/events/route.ts`; Hero `store/jovy/marketing/hero/route.ts`; Banner `banners/[slot]/route.ts`; Marca `store/jovy/brand/gallery/route.ts`; E2E content, events, hero, banners y brand. | Cubierto también en Banners con E2E y unit de visibilidad. |
| T2 | Auditoría de actor, acción, entidad y fecha | `Implementada parcialmente` | Workflows de todos los módulos; E2E content `jovy-content.spec.ts:107-126`; contactos `jovy-contacts.spec.ts:76-79`. | No hay pruebas de auditoría para Hero, Banner, Eventos ni Marca. |
| T3 | Soft delete de contenido editorial | `Implementada y validada` | Modelos DML con `deleted_at`; E2E content `jovy-content.spec.ts:115-126`. | Validado para páginas. Otros módulos usan DELETE en limpieza, sin assert de soft delete. |
| T4 | Restauración tras borrado lógico en CMS | `Pendiente` | No hay rutas/workflows de restore en `apps/backend/src`; solo delete en workflows CMS. | Aplica a páginas, Hero, banners, eventos, galería, logos y contactos. |
| T5 | Configuración corporativa general | `Pendiente` | Solo existe configuración de color Hero `models/hero-settings.ts:3-6`; no hay modelo/ruta/UI de datos de empresa, footer, redes o certificados. | No confundir color global Hero con configuración corporativa completa. |
| T6 | Políticas de tienda por región | `Resuelta por Medusa nativo` | `lib/region-store-policies.ts:6-24`; seed `migration-scripts/region-store-policies.ts:6-31`; metadata nativa de región. | Envío/devoluciones viven en metadata de región; se editan en Settings → Regions → Metadata. Sin prueba propia. |

## Resumen de conteos

| Clasificación | Total |
| --- | ---: |
| `Implementada y validada` | 37 |
| `Implementada parcialmente` | 9 |
| `Resuelta por Medusa nativo` | 7 |
| `Pendiente` | 13 |
| `Descartada justificadamente` | 3 |
| **Total de filas históricas/transversales** | **69** |

### Conteo por módulo

| Módulo | Validada | Parcial | Nativo | Pendiente | Descartada | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Productos y categorías | 0 | 0 | 4 | 6 | 0 | 10 |
| Hero | 5 | 3 | 0 | 0 | 0 | 8 |
| Promociones / banners | 7 | 0 | 0 | 0 | 0 | 7 |
| Eventos | 9 | 0 | 0 | 0 | 0 | 9 |
| Galería Casa Jovy | 2 | 3 | 0 | 0 | 0 | 5 |
| Logos | 2 | 1 | 0 | 0 | 0 | 3 |
| Medios | 1 | 1 | 0 | 2 | 1 | 5 |
| Contactos | 9 | 0 | 0 | 1 | 0 | 10 |
| Usuarios/roles | 0 | 0 | 2 | 2 | 0 | 4 |
| Analítica/SSE | 0 | 0 | 0 | 0 | 2 | 2 |
| Transversales/configuración | 2 | 1 | 1 | 2 | 0 | 6 |
| **Total** | **37** | **9** | **7** | **13** | **3** | **69** |

## Brechas que bloquean paridad real

1. **Producto editorial ausente.** No hay módulo, modelo, migración, API, workflow ni widget para catálogo editorial, familia, gramaje, certificaciones, orden o restauración de productos. Es la brecha más grande de paridad.
2. **RBAC granular ausente.** Todas las rutas `/admin/jovy/*` solo exigen autenticación (`api/middlewares.ts:13-16`). No hay roles CMS/ventas ni permisos por módulo. `docs/19-SEGURIDAD-ADMIN.md` documenta el diseño, pero el módulo RBAC no está registrado.
3. **Ciclo de vida de medios incompleto.** La carga de imágenes está validada (PNG/JPEG/WebP y negativos), pero no hay borrado de archivos, video ni conteo de referencias.
4. **Exportación de contactos ausente.** No hay CSV/export ni endpoint equivalente. Además, el rate limit es en memoria y no apto para producción distribuida; la retención está documentada en `docs/26` pero no automatizada.
5. **Configuración corporativa incompleta.** Solo existe color global de Hero y políticas de tienda en metadata de región. No hay configuración estructurada de identidad, footer, redes o certificaciones.
6. **Cobertura E2E todavía desigual.** Content, Hero, Banners, Eventos, Marca y Contactos tienen spec propia, pero quedan sin E2E: CTA/color por elemento y ventana de Hero, reordenamiento y soft delete de Galería, ventana de Galería, auditoría de Hero/Banner/Eventos/Marca y el límite concurrente de cuatro (cubierto por integración, no por E2E).
7. **Restauración ausente.** Hay soft delete, pero no restore para productos ni para registros CMS.

## Brechas aceptables de laboratorio

- File Module local con archivos públicos; no apto para material sensible (`docs/23:50`).
- Rate limit de contactos en memoria; aceptable para una instancia local, no para producción.
- Recorte de logos como metadata no destructiva; no hay recorte de píxeles.
- Analítica y SSE diferidos por decisión explícita.
- Medusa nativo cubre producto, categoría, imágenes de producto, usuarios y políticas de región; no todo tiene E2E del repositorio.
- El CMS no duplica SKU, precio, variantes, stock ni pedidos; el Hero solo enlaza producto por ID.
- Las familias de logos son texto libre y no sustituyen una taxonomía canónica de familia de producto.

## Anexo: capacidades nuevas no exigidas por la auditoría histórica

Estas filas no se incluyeron en los totales de paridad.

| Capacidad nueva | Clasificación | Evidencia | Observación |
| --- | --- | --- | --- |
| Páginas editoriales bilingües con ciclo de vida | `Implementada y validada` | `models/editorial-page.ts:15-32`; E2E `jovy-content.spec.ts:34-127`. | Nueva respecto del administrador histórico. |
| SEO por página | `Implementada parcialmente` | Modelo `editorial-page.ts:9-13,21`; schema `lib/jovy/editorial-page.ts:16-32`; API acepta `seo`; UI `admin/routes/jovy/content/page.tsx:179-205` no expone campos SEO. | API/modelo listos; falta UI. |
| Programación de publicación de páginas | `Implementada parcialmente` | Modelo `editorial-page.ts:22`; schema `editorial-page.ts:39,50-63`; UI Content no expone `published_at`. | E2E no prueba fecha futura. |
| Store API de contenido publicado | `Implementada y validada` | `api/store/jovy/content/pages/[slug]/route.ts:5-22`; E2E `jovy-content.spec.ts:92-105`. | Requiere Publishable API Key nativa. |
| Límite de cuatro elementos de galería | `Implementada y validada` | `lib/jovy/brand.ts`; `lib/jovy/brand-persistence.ts`; `src/modules/jovy-brand/__tests__/brand-persistence.integration.test.ts`; `src/lib/jovy/__tests__/brand-visibility.test.ts`. | Concurrencia, ventanas contiguas y bordes exactos probados; la lectura Store aplica un tope defensivo de cuatro. |
