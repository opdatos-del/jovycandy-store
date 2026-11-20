# Auditoría de arquitectura — Medusa / CMS JovyCandy

**Corte:** 2026-11-20
**Alcance:** `apps/backend/src/{admin,api,modules,workflows,lib,links,jobs,subscribers}`.
**Fuera de alcance:** `apps/storefront`, proyectos históricos, Product Module nativo, esquema PostgreSQL y reglas de negocio.

## 1. Método

1. Inventario de archivos y tamaño por líneas.
2. Lectura de límites funcionales (páginas, API routes, workflows, módulos, libs).
3. Búsqueda de duplicaciones: clientes HTTP, modales, validaciones, medios, cabeceras, errores.
4. Contraste con `docs/15`, `docs/17`, `docs/21`, `docs/24`, `docs/28`, `docs/29`, `docs/30` y `docs/31`.
5. Línea base antes de tocar código:

| Check | Resultado |
|---|---|
| typecheck | 0 |
| lint | 0 errores; 2 warnings preexistentes en `.test-results` |
| unit | 32 suites / 332 pruebas |
| E2E (última consolidada) | 31/31 en 4.4 min |

La documentación de paridad se usa como contexto, no como fuente de verdad. El código manda.

## 2. Diagnóstico general

El backend ya respeta el flujo oficial de Medusa:

```text
API Route -> Workflow -> Module Service -> DML/PostgreSQL
```

Los ocho módulos tienen modelos, servicio, workflows y migraciones. No se detectaron imports de modelos de un módulo dentro de otro; las relaciones cruzadas usan Module Links o `product_id`/`file_id` como referencias. `src/lib/jovy` contiene reglas de dominio reutilizables y no depende de React ni de Express.

El problema principal está en el **Admin**: varias pantallas concentran estado de servidor, mutaciones, validaciones, carga de archivos y render en un solo archivo. También hay **cuatro clientes HTTP equivalentes** y **tres implementaciones de modal accesible**.

## 3. Inventario de problemas

| Archivo | Líneas | Responsabilidad actual | Problema | Evidencia | Propuesta | Prioridad | Riesgo | Pruebas |
|---|---:|---|---|---|---|---|---|---|
| `admin/routes/jovy-herramientas/marketing/components/banner-manager.tsx` | 1722 | Tipos, API, validación, formulario, tarjeta, filtros, stats y orquestación | Componente monolítico con 6+ responsabilidades | `BannerForm` empieza en ~1098; tipos/helpers 38-235; render 236-975 | `features/announcements/{types,api,components/banner-form,banner-card,banner-manager}` | Alta | Alto: E2E de banners y prioridad/orden | Banners 3/3, announcements 1/1 |
| `admin/routes/jovy/brand/components/logo-manager.tsx` | 761 | Tipos, API, crop modal, tarjeta, formulario y listado | Modal de recorte, formulario y tarjeta acoplados | `CropModal` 99-371; `LogoCard` 372+; estado/render en el mismo archivo | `features/logos/{types,api,components/crop-modal,logo-card,logo-form,logo-manager}` | Alta | Alto: crop, familias y Store | `jovy-brand`, `jovy-brand-families` |
| `admin/routes/jovy-herramientas/contacts/components/contact-inbox.tsx` | 877 | Fetching, polling, filtros, acciones, exportación y render | Estado de servidor mezclado con UI; fetch y descargas duplicados | `api()` local 41-64; `fetch` de export 527/582; render 628+ | `features/contacts/{api,hooks/use-contact-query,components}`; cliente HTTP y descarga compartidos | Alta | Medio: filtros, polling, papelera y export | Unit `inbox.test`, E2E contactos |
| `admin/routes/jovy/novelties/page.tsx` | 642 | Lista, filtros, alta/edición, multimedia, acciones y persistencia | Página monolítica; lógica de API y estado en el componente | Estado 64-100; `load/save/upload` 100-450; render 470+ | `features/novelties/{api,hooks/use-novelties,components/novelties-page}` | Alta | Medio: E2E Novedades | `jovy-novelties` |
| `admin/routes/jovy/brand/components/gallery-manager.tsx` | 608 | Galería: carga, edición, orden, publicación, lightbox | Varias responsabilidades y helpers locales | manager y `GalleryItem` juntos; `gallery-api` separado | `features/gallery` con card, form, upload y manager | Media | Medio: cupo 4 y E2E brand | `jovy-brand` |
| `admin/routes/jovy/launches/page.tsx` | 497 | Lista, modal, color global, orden y acciones | Página con formulario (`launch-form`) y estado de servidor | `launch-form` ya separado; la página aún concentra fetch/acciones | `features/launches/{api,hooks,components}` | Media | Medio: E2E launches | `jovy-launches-admin` |
| `admin/widgets/product-editorial.tsx` | 421 | Ficha editorial: fetch, formulario, estado y acciones | Widget monolítico con varias secciones | fetch/estado/render en un archivo | `features/product-editorial/{api,components,use-editorial}` | Media | Medio: Store y E2E editorial | `jovy-product-editorial` |
| `admin/routes/jovy/catalogue/page.tsx` | 360 | Tarjetas, formulario, orden y vínculo | Aceptable, pero formulario/tarjeta comparten archivo y helpers | `category-form` y `category-card` ya separados | `features/catalogue/{api,hooks,components}` | Media | Bajo | `jovy-catalogue-admin` |
| `admin/routes/jovy-herramientas/marketing/components/hero-manager.tsx` | 248 | Hero: fetch, formulario, acciones y color global | Menos crítico, pero sin API/hook separados | fetch y estado en el componente | `features/marketing` | Baja | Bajo | `jovy-hero` |
| `admin/routes/jovy-herramientas/events/page.tsx` | 117 | Eventos y tipos | Página corta pero con fetch/acciones inline | formulario + tipos en un archivo | `features/events` | Baja | Bajo | `jovy-events` |
| `admin/routes/jovy-herramientas/content/page.tsx` | 205 | Páginas editoriales | Fetch/estado/render mezclados | sin hook ni cliente | `features/content` | Baja | Bajo | `jovy-content` |
| `admin/routes/jovy/components/admin-api.ts` | 89 | Cliente HTTP | Duplica `marketingApi` y `galleryRequest` | mismo manejo de cookie/error en 4 archivos | `shared/lib/admin-api` y re-exports | Alta | Bajo | unit/build |
| `admin/routes/jovy-herramientas/marketing/components/admin-api.ts` | 20 | Cliente HTTP + fechas | Duplica cliente; no conserva status | `marketingApi` propio | Re-export de `shared` + helpers de fecha | Alta | Bajo | build |
| `admin/routes/jovy/brand/components/gallery-api.ts` | 60 | Cliente HTTP + validación de imagen | Duplica cliente/validación | `galleryRequest` propio | Re-export de `shared` | Alta | Bajo | build |
| `admin/shared` (nuevo) | — | Cliente, medios, color, diálogo, cabecera | — | — | Base de features | — | — | typecheck/build |

## 4. Duplicaciones concretas

### 4.1 Cliente HTTP
Cuatro implementaciones repiten `fetch` con `credentials: "include"`, `Content-Type` condicional, lectura de errores y `204`:

- `admin/routes/jovy/components/admin-api.ts`
- `admin/routes/jovy-herramientas/marketing/components/admin-api.ts`
- `admin/routes/jovy/brand/components/gallery-api.ts`
- `admin/features/contacts/components/contact-inbox.tsx` (local `api`)

**Decisión:** un solo `@admin/shared/lib/admin-api.ts` con `AdminApiError`, `adminRequest`, `errorMessage`, `adminQuery`, `downloadAdminFile` y `saveBlob`. Los antiguos archivos quedan como re-exports para no romper imports.

### 4.2 Modales accesibles
La misma mecánica de portal, foco, Escape, scroll lock y restauración está en:

- `contacts/components/contact-dialog.tsx`
- `novelties/components/novelty-form.tsx`
- `brand/components/logo-manager.tsx` (`CropModal`)

**Decisión:** `@admin/shared/components/admin-dialog.tsx`. ContactDialog y NoveltyForm ya lo usan. El crop de logos se migra solo si conserva su interacción específica.

### 4.3 Medios
Constantes y validaciones de imagen repetidas en banners, galería, logos, lanzamientos, categorías y novedades.

**Decisión:** `@admin/shared/lib/media.ts` con tipos, aceptación, tamaño y `validateImageFile`. Cada dominio conserva su endpoint y su límite específico (logos 20 MB/GIF).

### 4.4 Cabeceras y estados
Cada pantalla repite `Container + Heading jovy-title + Text + acciones`.

**Decisión:** `@admin/shared/components/page-header.tsx`; se adopta de forma incremental, sin cambiar el DOM visual.

## 5. Dependencias y límites

- **Frontend:** `routes -> features -> shared`. Una feature no importa componentes privados de otra.
- **Backend:** `api -> workflows -> modules`. Las lecturas pueden usar Module Service/Query; no se crean workflows artificiales.
- **Contratos:** las rutas y envelopes no cambian. Los tipos de UI permanecen en la feature o en `types.ts`; no se importan modelos DML en React.
- **Alias:** `@admin/*` se resuelve en Vite (config `admin.vite`), TypeScript (`paths`) y Jest (`moduleNameMapper`). Evita cadenas `../../..` y la regla de lint.

## 6. Hallazgos adicionales

| Hallazgo | Evidencia | Acción |
|---|---|---|
| `gallery-agenda.tsx` no se monta | búsqueda sin usos | Documentar; no borrar sin decisión de producto |
| `catalogue/storefront-preview.tsx` no se monta | búsqueda sin usos | Documentar; no borrar |
| Directorios `routes/jovy/products` y `routes/jovy/users` sin `page.tsx` | inventario de rutas | Confirmar que son restos; no eliminarlos en esta fase sin autorización |
| API routes repiten `safeParse -> 400` | contacts/events/catalogue | Extraer solo si se reutiliza en un dominio; no crear capa genérica |
| `lib/jovy` agrupa reglas por dominio | `contacts.ts`, `marketing.ts`, `events.ts`, `brand.ts`... | Mantener; no crear `utils` genérico |
| `published_at` se reescribe en guardados de eventos/banners/hero | workflows | Documentar como decisión pendiente; no cambiar comportamiento |
| Borrado físico vs lógico inconsistente | workflows | Documentar; no cambiar política sin autorización |

## 7. Plan de refactorización

1. **Fundamentos:** `@admin` alias, cliente HTTP, medios, color, diálogo y cabecera compartidos.
2. **Contactos:** mover a `features/contacts`; API tipada, hook de consulta/polling y cliente de exportación.
3. **Anuncios/Banners:** separar tipos, API, formulario, tarjeta y orquestador.
4. **Logos:** separar tipos, API, crop, tarjeta, formulario y gestor.
5. **Novedades:** separar API, hook y página; conservar el editor modal ya extraído.
6. **Galería/Lanzamientos/Catálogo/Producto editorial:** adoptar el patrón por dominio sin cambiar contratos.
7. **Backend:** documentar el flujo y extraer solo duplicaciones demostradas; no mover reglas de negocio sin necesidad.
8. **Verificación:** typecheck, lint, unit, integración, E2E, build y revisión visual.

## 8. Resultado de esta ola

Implementado y verificado:

| Área | Resultado |
|---|---|
| Alias | `@admin/*` en Vite, TypeScript y Jest; sin cadenas `../../..` en features |
| Shared | `admin-api`, `media`, `color`, `AdminDialog`, `PageHeader` |
| Contactos | `features/contacts/{api,hooks/use-contact-query,components}`; página de ruta solo registra |
| Anuncios | `features/announcements/{types,api,components/banner-form,banner-card,banner-manager}` |
| Logos | `features/logos/{types,api,lib/crop,components/crop-modal,logo-card,logo-form,logo-manager}` |
| Novedades | `features/novelties/{model,types,api,hooks/use-novelties,components/novelties-page,header,filters,empty-state,card,form}` |
| HTTP duplicado | Re-exports de compatibilidad; un solo cliente real |
| Modales | `AdminDialog` usado por Contactos y Novedades; crop de Logos conserva su interacción |
| Backend | Sin cambios de contrato; el flujo API → Workflow → Module ya era el correcto y no se justificó una capa extra |

Pendiente de la siguiente ola, sin romper lo actual: Galería, Lanzamientos, Catálogo, Producto editorial, Dashboard, Contenido, Eventos y Marketing. La auditoría deja el patrón y los límites definidos.

### Verificación de la ola

| Check | Resultado |
|---|---|
| typecheck | 0 |
| lint | 0 errores; 2 warnings preexistentes |
| unit | 32 suites / 332 pruebas |
| integración módulos | 6 suites / 37 pruebas |
| integración HTTP | 11 suites / 76 pruebas |
| E2E | 31/31 en 4.9 min |
| build | OK |

Dos pruebas de integración tenían expectativas anteriores al contrato vigente: el banner de Store ya devuelve `rotation_seconds` y la exportación ya acepta `format=xlsx`. Se actualizaron las expectativas, sin cambiar el comportamiento.

Validación visual (1440/375, claro/oscuro) de Contactos, Anuncios, Logos y Novedades: 0 overflow de página, 0 errores de consola. El DOM conserva clases, badges, `<details>`, menús y modales. El 404 de medios era operativo: al arrancar desde `.medusa/server` faltaba el enlace a `static`; se resolvió con un junction documentado en `docs/02`.

## 9. Riesgos de regresión

- **Banners:** prioridad/orden, `Subir/Bajar`, rotación, ventanas, `auto_open` y testids de E2E.
- **Logos:** crop, familias, límite 20 MB, testids y confirmaciones.
- **Contactos:** polling, filtros, papelera/restore, export CSV/XLSX y contadores.
- **Novedades:** modal, foco, Escape, scroll, multimedia y E2E.
- **Visual:** no cambiar clases, textos, radios, tokens ni jerarquía. Cualquier extracción debe conservar el DOM efectivo.

## 10. Criterio de cierre

La refactorización se considera válida solo si:

- typecheck/lint/build en 0;
- unit, integración y E2E verdes;
- los contratos HTTP no cambian;
- las pantallas mantienen comportamiento y apariencia;
- cada feature tiene límites claros y no hay imports cruzados privados;
- la documentación `docs/33` y `docs/34` describe la arquitectura final.
