# Matriz de paridad — pantallas del administrador histórico vs Admin de Medusa

**Corte:** 2026-11-17. **Alcance:** paridad **por pantalla** de las 13 opciones del menú
histórico (`admin-webjovy`) contra el Admin real de `apps/backend` (Medusa 2.22.6).

**Estado vigente del menú:** el grupo «JovyCandy CMS» tiene **11 entradas**; Productos y
Usuarios son ya solo superficies nativas (`/app/products` y `/app/settings/users`), sin las
antiguas rutas `/app/jovy/products` ni `/app/jovy/users`. La última bandeja se llama
«Catálogo — Solicitudes». Modelo comercial y permisos en
[docs/30](30-MODELO-COMERCIAL-Y-PERMISOS.md).

**Relación con otras matrices:** `docs/24-MATRIZ-PARIDAD-ADMIN.md` sigue siendo la matriz
**técnica por funcionalidad** (modelo, API, workflow, prueba); este documento es la matriz
**por pantalla** (menú, ruta, CRUD visible y E2E). `docs/29-PARIDAD-VISUAL-FUNCIONAL-CMS.md`
evalúa la paridad visual y funcional contra el histórico. Desde el 2026-11-17, ocho pantallas
tienen comparación contra el **admin histórico real ejecutado en localhost con login real** (seis
prioritarias, Galería —solo listado 1440— y Dashboard —1440, con composite `dashboard-1440`—); la
copia aislada DEMO queda como evidencia complementaria. Usuarios está `PENDIENTE DE COMPARACIÓN
(BLOQUEADO POR PII)`: su captura histórica contiene correos y nombres reales del administrador
antiguo y no se replica en composites. Las cuatro bandejas siguen pendientes, también bloqueadas
por PII: su captura histórica única sin distinción por tipo contiene datos personales reales y no se
propaga. Ninguna se declara réplica aceptada ni se afirma fidelidad total. No
se duplican los 74 juicios de `docs/24`: aquí se agrupan por la pantalla que los expone.

**Alcance del estado:** esta matriz juzga **funcionalidad de pantalla**, no fidelidad visual. El
estado `Completa funcional (sin paridad visual)` significa que la función histórica está cubierta y
tiene E2E propio, pero **no** que la pantalla sea una réplica visual aceptada ni que suba el estado
de `docs/29`. Con la ejecución real del 2026-11-17, Categorías y Galería tienen par (Galería solo
en listado 1440); las cuatro bandejas siguen sin composite y pendientes en `docs/29`, bloqueadas por
PII.

**Método:** lectura del código del Admin (`defineRouteConfig`, `src/admin/routes/jovy/**`,
`src/admin/widgets/product-editorial.tsx`), de las rutas `src/api/admin/jovy/**` y de las 14
specs de `apps/backend/e2e/`. Los conteos de regresión son los de la corrida consolidada
registrada en `docs/21`; **esta revisión documental no re-ejecutó la suite**.

## Criterios de estado

| Estado | Criterio aplicado |
| --- | --- |
| `Completa funcional (sin paridad visual)` | Todas las funciones históricas de la pantalla existen y la pantalla tiene spec E2E propia que ejercita el ciclo principal (alta/edición/publicación o equivalente). No implica paridad visual: `docs/29` registra comparaciones contra el admin histórico real ejecutado, pero persisten diferencias visibles; Usuarios y las cuatro bandejas están bloqueadas por PII. |
| `Funcionalmente parcial` | La pantalla existe y se usa, pero falta al menos una función histórica, alguna parte es de solo lectura o el ciclo principal no tiene E2E propio. |
| `Implementada, pero no visible` | Hay API/modelo/UI en el repositorio, pero ninguna entrada de menú ni pantalla lo expone. |
| `Pendiente` | La función histórica no tiene modelo, ruta, UI ni prueba en el repositorio. |
| `Sustituida por Medusa nativo` | La capacidad se resuelve con Admin/API nativo y no se reimplementó. |
| `Bloqueada por decisión comercial/licencia` | La capacidad existe en Medusa pero requiere una licencia o decisión comercial que el proyecto no tiene. |

## Menú anterior (13 opciones) vs sidebar nuevo real

Tras la tercera ola (2026-11-17) el sidebar reproducía las 13 entradas históricas en orden;
el **estado vigente** del grupo **JovyCandy CMS** tiene **11 entradas**: Dashboard
(`/app/jovy/dashboard`), Categorías, Nuevos Lanzamientos, Casa Jovy Galería, Logos
(`/app/jovy/logos`), Anuncios de portada, Novedades y las cuatro bandejas
`/app/jovy/contacts-*` (la última, «Catálogo — Solicitudes»). Productos y Usuarios ya no
tienen entrada: son solo `Products` (`/app/products`) y `Settings → Users`
(`/app/settings/users`), sin identidad paralela. Las cuatro funciones
aditivas (Contenido, Marketing, Eventos y Contactos consolidados) se movieron al grupo hermano
**JovyCandy · Herramientas**, con rutas `/app/jovy-herramientas/{content,events,marketing,contacts}`;
sus componentes compartidos (`banner-manager`, `contact-inbox`, `ordering`) también viven ahí y se
importan con rutas relativas porque el Vite del Admin no resuelve el alias `@jovy/*`. Medusa anida
las rutas hijas bajo el padre del grupo; el campo oficial `nested` solo admite rutas nativas, no
`/jovy/*`.

| # | Menú histórico | Sidebar nuevo (etiqueta real) | Ruta | Rank |
| ---: | --- | --- | --- | ---: |
| 1 | Dashboard | Dashboard | `/app/jovy/dashboard` | 1 |
| 2 | Productos | Solo nativo: `Products` (`/app/products`) + widget editorial `product.details`; ya no hay entrada en el menú CMS | `/app/products` | — |
| 3 | Categorías | Categorías del catálogo | `/app/jovy/catalogue` | 3 |
| 4 | Nuevos lanzamientos | Nuevos lanzamientos | `/app/jovy/launches` | 4 |
| 5 | Casa Jovy · Galería | Casa Jovy Galería | `/app/jovy/brand` | 5 |
| 6 | Logos | Logos | `/app/jovy/logos` | 6 |
| 7 | Anuncios de portada | Anuncios de portada | `/app/jovy/announcements` | 7 |
| 8 | Novedades | Novedades | `/app/jovy/novelties` | 8 |
| 9 | Usuarios | Solo nativo: `Settings → Users` (`/app/settings/users`), sin identidad paralela; ya no hay entrada en el menú CMS | `/app/settings/users` | — |
| 10 | Solicitudes · Ventas nacionales | Ventas Nacionales | `/app/jovy/contacts-national-sales` | 10 |
| 11 | Solicitudes · Ventas internacionales | Ventas Internacionales | `/app/jovy/contacts-international-sales` | 11 |
| 12 | Solicitudes · Atención al cliente | Atención al Cliente | `/app/jovy/contacts-customer-service` | 12 |
| 13 | Solicitudes · Catálogo | Catálogo — Solicitudes | `/app/jovy/contacts-catalogue` | 13 |

**Nota (tercera ola, 2026-11-17; registro histórico):** en esa ola los labels y los ranks del
sidebar reproducían la secuencia histórica de 13 entradas de esta tabla (columna «#»). El estado
vigente tiene **11 entradas**: las filas 2 y 9 (Productos, Usuarios) son ya solo superficies
nativas y no figuran en el menú CMS. La fila 1 usa la ruta dedicada `/app/jovy/dashboard`. Las
cuatro funciones aditivas están en el grupo hermano «JovyCandy · Herramientas»
(`/app/jovy-herramientas/*`). Ver `docs/29` §«Tercera ola» y `docs/30`.

Las cuatro funciones aditivas sin equivalente 1:1 en el menú histórico —**Contenido Jovy**,
**Marketing Jovy**, **Eventos Jovy** y **Contactos Jovy** (vista consolidada de las cuatro
bandejas)— ya no están en este grupo: viven en el grupo hermano **JovyCandy · Herramientas** bajo
`/app/jovy-herramientas/{content,events,marketing,contacts}`. Sus componentes compartidos
(`banner-manager`, `contact-inbox`, `ordering`) se importan con rutas relativas porque el Vite del
Admin no resuelve el alias `@jovy/*`.

Observaciones del menú real:

- Hay **cuatro** bandejas de contactos en el grupo CMS (`/app/jovy/contacts-*`); la vista
  consolidada «Contactos Jovy» pasó al grupo Herramientas (`/app/jovy-herramientas/contacts`). Las
  cuatro bandejas comparten componente, endpoint y tabla; solo cambia el `contact_type` fijado por
  ruta.
- La etiqueta **«Catálogo — Solicitudes»** (bandeja de solicitudes de catálogo) convive con
  **«Categorías del catálogo»**. Son pantallas distintas sobre datos distintos; se documenta
  como riesgo de usabilidad, no como defecto funcional.
- `Contenido Jovy`, `Marketing Jovy`, `Eventos Jovy` y `Contactos Jovy` no aparecen en la lista
  histórica de 13 opciones porque el histórico resolvía esos contenidos en otras pantallas o
  directamente en la web; en Medusa son pantallas propias del grupo «JovyCandy · Herramientas».

## Matriz por pantalla

| Pantalla original | Funciones requeridas | Destino Medusa | Visible en menú (sí/no y etiqueta) | CRUD operativo (qué operaciones, no "sí") | Datos relacionados | E2E (spec) | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Dashboard | Tablero con métricas del CMS (visitas, productos top) y accesos | `/app/jovy/dashboard` (nuevo; reutiliza el dashboard) | Sí — «Dashboard» | Sin CRUD: lectura de `GET /admin/jovy/dashboard` (401 sin sesión) y enlaces. H1 «Dashboard», marca «JovyCandy CMS», KPIs en grilla 1/3 responsive, conteos de productos, categorías, páginas, hero, banners, eventos, galería, logos y solicitudes pendientes, tarjetas de acceso y sección de analítica. La edición ocurre en cada pantalla enlazada. | Product Module, `jovy_content`, `jovy_marketing`, `jovy_events`, `jovy_brand`, `jovy_contacts`. Sin fuente de analítica web. | `jovy-cms-navigation.spec.ts` | `Funcionalmente parcial` |
| 2. Productos | Catálogo editorial: familia, gramaje, certificaciones, imágenes, publicación, orden y restauración, sin duplicar datos comerciales | `Products` nativo (`/app/products`) + widget «Ficha editorial Jovy» en `product.details`; sin entrada en el menú CMS | No (solo nativo) | Comercial (nativo): alta, edición y borrado de producto, variantes, precios, stock e imágenes. Editorial: edición exclusiva vía widget `product.details` en el detalle nativo; agregado en `GET /admin/jovy/products/editorial`; crear/actualizar ficha (`PUT /admin/jovy/products/:id/editorial`), publicar, archivar, restaurar (`POST .../editorial/restore`), ordenar por `sort_order`; el widget agrupa la edición y confirma guardar, restaurar, publicar, archivar y eliminar. No escribe SKU, precio, stock ni variantes. `published_at` es set-once. El Store solo publica fichas `published` cuyo producto comercial siga `published` (`product_status`). | `product.product`, `jovy_product_editorial`, Module Link `jovy_product_family ⇄ product.product`, `jovy_catalogue_category.medusa_category_id` | `jovy-product-editorial.spec.ts` (gramaje, certificaciones, novedad, orden, publicar/archivar, Store); `Products` nativo sin E2E | `Funcionalmente parcial` |
| 3. Categorías | Seis tarjetas de presentación con nombre, descripción, orden, publicación, «próximamente», bloqueo de interacción, imagen y vínculo comercial | `/app/jovy/catalogue` | Sí — «Categorías del catálogo» | Leer las 6 tarjetas en grid 1/3, editar en formulario separado con contenido `lg:col-span-8` y configuración `lg:col-span-4`, reordenar (`POST .../reorder`) y sembrar claves ausentes (`POST .../seed`). Sin alta ni borrado: el conjunto de claves es fijo, igual que el histórico. | `jovy_catalogue_category` (6 claves), File Module para la imagen, Product Category vía `medusa_category_id`, `jovy_product_family` | `jovy-catalogue-admin.spec.ts` (seis tarjetas, proporción 8/4, edición, «Próximamente», reactivación, imagen, reorden, vínculo comercial, ocultar) | `Completa funcional (sin paridad visual)` |
| 4. Nuevos lanzamientos | Lista ordenada y activa con producto, imagen y color de fondo global | `/app/jovy/launches` | Sí — «Nuevos lanzamientos» | Crear, leer, actualizar, borrar lógicamente **sin restore expuesto**, reordenar y activar/desactivar (`GET/POST /admin/jovy/launches`, `GET/PUT/DELETE .../:id`, `POST .../reorder`); ajuste global `GET/PUT .../launches/settings` (color por defecto `#00AFAA`). UI con tarjetas 1/2/4, modal histórico de alta/edición (portal, `role=dialog`, foco y Escape, «Nuevo Slide», «Opciones adicionales» plegables), ocho presets y hex, y confirmaciones de color/eliminar. Sin DnD: el orden usa flechas. | `jovy_launch`, `jovy_launch_settings`, Product Module (`product_id`), File Module | `jovy-launches-admin.spec.ts` (producto, imagen, orden, visibilidad, preset, hex válido e inválido) | `Funcionalmente parcial` |
| 5. Casa Jovy · Galería | Imagen, orden y reordenamiento, borrado con confirmación, máximo 4 visibles, ventana de programación | `/app/jovy/brand`, pestaña «Galería» | Sí — «Casa Jovy Galería» | Crear con PNG/JPEG/WebP real, carga múltiple secuencial con confirmación, editar, publicar/archivar, reordenar con confirmación y **borrado físico** con confirmación (la ruta ejecuta `deleteJovyGalleryItems`; no hay restore); contador `n/4`, agenda/solapes y lightbox. El límite de 4 simultáneas lo aplica el Locking Module. | `jovy_gallery_item`, File Module, Locking Module | `jovy-brand.spec.ts` (alta, carga múltiple, cupo, lightbox, edición, publicación/archivo, reorden con persistencia y borrado con confirmación) | `Completa funcional (sin paridad visual)` |
| 6. Logos | Logo por familia, orden y reordenamiento, recorte no destructivo | `/app/jovy/logos` (ruta separada) | Sí — «Logos» | Crear, editar en panel separado, activar/desactivar, reordenar y eliminar con **borrado físico** y confirmación (sin restore); selector de familias reales filtrado por categoría; recorte en modal accesible con pan/zoom/guía/reset como metadatos (`zoom`, `offset_x`, `offset_y`) sin transformar el original, y carril propio `POST /admin/jovy/brand/logos/media` de 20 MB para PNG/JPEG/WebP/GIF (SVG bloqueado por XSS); el carril general de marketing sigue en 5 MB. | `jovy_brand_logo`, `jovy_brand_logo_family`, `jovy_product_family`, File Module | `jovy-brand.spec.ts` (logo, crop, confirmaciones, desactivación en Store) y `jovy-brand-families.spec.ts` (vínculo real). Reorden sin E2E | `Funcionalmente parcial` |
| 7. Anuncios de portada | Banner de portada (`promo` y `hint`) | `/app/jovy/announcements` (slots `promo` y `hint`) | Sí — «Anuncios de portada» | CRUD unificado de ambos slots en la misma pantalla con selector de lugar, gestor embebido, filtro por tipo, presets de vigencia y `rotation_seconds` 3–60 por banner; no duplica tabla ni endpoints. El mensaje corporativo ES/EN ya no se edita aquí: vive en **Marketing Jovy**, bajo el Hero. | `jovy_marketing_banner` (slots `promo`/`hint`), File Module; el mensaje corporativo vive en `jovy_announcement_settings` y se edita en Marketing Jovy | `jovy-announcements-admin.spec.ts`; cubierto también por `jovy-banners.spec.ts`; mensaje corporativo en `jovy-hero.spec.ts` | `Funcionalmente parcial` |
| 8. Novedades | Bandeja multimedia (imagen, GIF o video) con vista previa, reemplazo/retiro, prioridad/orden y activo | `/app/jovy/novelties`, sobre `jovy_events` | Sí — «Novedades» | Grid multimedia 1/2/3/5, búsqueda y filtros de estado, tipo y activo, enlace al evento exacto; adjuntar/reemplazar/retirar medio y editar prioridad y activo sobre eventos existentes; imagen por `/admin/jovy/marketing/media` y video por `/admin/jovy/events/media/video` (≤100 MB, firma real). No crea, borra ni restaura el evento: eso vive en Eventos Jovy, donde el borrado es **lógico** desde el fix de backend, pero su restore aún no está expuesto en Novedades. | `jovy_event` (`media_file_id`, `media_url`, `media_type`), File Module | `jovy-novelties.spec.ts` (video real, persistencia, prioridad, activo, retiro, borrador, evento exacto, Store) | `Funcionalmente parcial` |
| 9. Usuarios | Login, gestión de usuarios, bloqueo y roles internos CMS/ventas | `/app/settings/users` (solo nativo) | No (solo nativo; `Settings → Users`) | Alta, edición y baja de usuarios nativas. No se replican roles, filtros, estados, bloqueo ni hard delete históricos: `@medusajs/rbac` es Enterprise y no está licenciado/registrado; cualquier `user` autenticado es admin pleno. | `user` de Medusa; sin tablas propias | Sin E2E propio; el login lo ejercitan las specs que inician sesión | `Bloqueada por decisión comercial/licencia` |
| 10. Solicitudes · Ventas nacionales | Tabla del tipo, filtros, contadores, detalle, estado, notas, borrado lógico y exportación | `/app/jovy/contacts-national-sales` | Sí — «Ventas Nacionales» | Tabla de seis columnas (Fecha, Cliente, Contacto, Ubicación, Mensaje, Acciones), tabs Todos/Pendiente/Atendido/Papelera con counts, búsqueda por nombre/apellido/email/teléfono/ciudad/país/CP, fechas, páginas 10/20/50, detalle/edición/auditoría en modales, atender/volver, soft delete + restore (`POST .../:id/restore`), export CSV por bandeja (`GET .../export`) y polling cada 30 s. | `jovy_contact_request` (una tabla para los cuatro tipos), `jovy_contact_audit_log`; migración `Migration20261114120000` | `jovy-contact-inboxes.spec.ts` (cuatro bandejas, tabla, filtros, tabs, fechas, modales, papelera, restore, export) y `jovy-contacts.spec.ts` | `Completa funcional (sin paridad visual)` |
| 11. Solicitudes · Ventas internacionales | Ídem, con tipo internacional fijado por la ruta | `/app/jovy/contacts-international-sales` | Sí — «Ventas Internacionales» | Ídem con `contact_type` internacional; el servidor revalida el enum y responde `400` fuera de él. Incluye papelera, restore y export CSV. | Ídem | `jovy-contact-inboxes.spec.ts` | `Completa funcional (sin paridad visual)` |
| 12. Solicitudes · Atención al cliente | Ídem, con tipo atención al cliente | `/app/jovy/contacts-customer-service` | Sí — «Atención al Cliente» | Ídem con `contact_type` de atención al cliente, incluida papelera, restore y export CSV. | Ídem | `jovy-contact-inboxes.spec.ts` | `Completa funcional (sin paridad visual)` |
| 13. Solicitudes · Catálogo | Ídem, con tipo catálogo | `/app/jovy/contacts-catalogue` | Sí — «Catálogo — Solicitudes» | Ídem con `contact_type` de catálogo, incluida papelera, restore y export CSV. | Ídem | `jovy-contact-inboxes.spec.ts` | `Completa funcional (sin paridad visual)` |

Notas de fila:

1. **Fila 1.** El tablero es nuevo y está validado por E2E; tiene H1 «Dashboard», marca «JovyCandy CMS», KPIs 1/3,
   rangos 7/30/90/personalizado y refresco automático de 60 s pausado en pestaña oculta, pero **no**
   reproduce la analítica histórica (`page_views`, productos top): esa fuente no existe y la sección
   declara «No disponible: falta fuente analítica». No se inventaron cifras.
2. **Fila 2.** La ficha editorial cubre gramaje, certificaciones (SGS/OU Kosher/Halal), `is_new`,
   `sort_order`, estado y restauración. La **familia** se muestra derivada de la categoría
   comercial y del Module Link; la asignación manual producto↔familia sigue pendiente
   (`docs/27` §7), y restaurar en esta pantalla solo aplica a la ficha editorial; las solicitudes de
   contacto tienen su propio restore. El Store
   filtra por `editorial_status = published` **y** producto comercial `published`; publicar la
   ficha no publica el producto comercial. El listado usa tarjetas 1/2/3/4/5 y no tiene DnD ni
   paginación backend.
3. **Fila 3.** `coming_soon` es un estado no publicado: el backend normaliza
   `coming_soon => active = false` e `interaction_locked = true`, y desmarcarlo reactiva y
   desbloquea, como el histórico. El Store devuelve `active`; las familias Store ocultan categorías
   no publicables o bloqueadas. El formulario está separado con proporción 8/4 y confirmación
   `usePrompt`.
4. **Filas 5-6.** Galería ya tiene E2E de carga múltiple, contador, lightbox, reorden con
   persistencia y borrado con confirmación; el límite de cuatro está cubierto por integración y
   E2E de cupo. Galería y Logos borran **físicamente** y no ofrecen restore. Logos tiene crop
   visual con pan/zoom/guía/reset y confirmaciones, pero su reordenamiento sigue sin E2E propio y
   no replica DnD contextual ni rutas separadas.
5. **Fila 8.** Se reutiliza `jovy_events` porque el histórico usaba la misma entidad para eventos y
   novedades; la bandeja Novedades es una vista multimedia de esa entidad, no una tabla nueva.
6. **Fila 9.** La ausencia de RBAC es una limitación de licencia, no una omisión de implementación;
   el diseño está en `docs/19-SEGURIDAD-ADMIN.md`.
7. **Filas 10-13.** Las cuatro bandejas siguen siendo rutas planas bajo `/app/jovy/*` en el grupo
   CMS porque Medusa no anida dos niveles de rutas propias en el sidebar; la vista consolidada
   «Contactos Jovy» quedó en el grupo Herramientas (`/app/jovy-herramientas/contacts`). No hay
   tablas por bandeja ni duplicación de endpoints. La tabla de
   seis columnas, tabs, búsqueda, fechas, páginas 10/20/50, papelera, restore, export CSV y polling
   son compartidos; solo cambia el `contact_type` fijado por la ruta.
8. **Fila 7.** Anuncios es el único CRUD de los dos banners (`promo`/`hint`); el gestor embebido
   cubre alta/edición, publicación, archivo, orden, ventana, frecuencia y `rotation_seconds` por
   banner. El mensaje corporativo ES/EN se edita en **Marketing Jovy**, bajo el Hero
   (`CorporateMessagePanel` + `CorporateMessageForm`, testid `marketing-corporate-block`, E2E
   `jovy-hero.spec.ts`). Marketing conserva Hero y solo enlaza «Abrir Anuncios de portada».
   El crop de banner sigue pendiente porque el backend no persiste `crop_zoom`/offsets.
9. **Fila 8.** Novedades reutiliza `jovy_events` y ya tiene grid, búsqueda, filtros, preview y enlace
   al evento exacto. No restaura eventos ni acepta medio por URL externa; el alta/borrado del evento
   sigue en Eventos Jovy. Hoy ese borrado es lógico y su restore sigue pendiente de diseño.

## Pantallas que mezclaban capacidades

Varias opciones históricas eran una sola pantalla con dos o más capacidades distintas. En Medusa
se separaron o se resolvieron con una entidad compartida:

| Pantalla histórica | Capacidades mezcladas | Resolución actual |
| --- | --- | --- |
| Anuncios de portada | Banner de portada (`promo` y `hint`: imagen, frecuencia, ventana, rotación) + mensaje corporativo bajo la animación | Los banners reutilizan `jovy_marketing_banner` y solo se ampliaron de forma aditiva `rotation_seconds` y `frequency = once`; Anuncios conserva un único CRUD con gestor embebido y selector de lugar. El mensaje corporativo pasó a **Marketing Jovy**, bajo el Hero (`CorporateMessagePanel` + `CorporateMessageForm`, testid `marketing-corporate-block`, E2E `jovy-hero.spec.ts`), con `jovy_announcement_settings` editable ES/EN. |
| Logos | Archivo de imagen + taxonomía de familias | Una pantalla con dos relaciones: archivo en File Module y `jovy_brand_logo_family` contra `jovy_product_family`. El legado `families` se conserva y `families_linked` distingue «nunca vinculado» de «vinculación vacía». |
| Contactos / Solicitudes | Cuatro bandejas + una tabla + contadores + detalle | Cuatro rutas planas en el grupo CMS que comparten `contact-inbox.tsx` (ahora en el grupo Herramientas, importado con ruta relativa), `GET /admin/jovy/contacts` y la tabla `jovy_contact_request`; los contadores son una agregación SQL por tipo y estado. |
| Productos | Producto comercial (SKU, precio, stock, variantes) + atributos editoriales (gramaje, certificaciones, orden) | El producto sigue en el Product Module; el CMS agrega la ficha editorial en un widget del detalle y una lista propia, sin duplicar datos comerciales. |
| Categorías | Tarjetas de presentación + vínculo a la taxonomía comercial + familias | `jovy_catalogue_category` mantiene las 6 claves y su presentación; `medusa_category_id` enlaza la Product Category y de ahí se derivan familias y productos. |
| Novedades | Evento + multimedia | La bandeja Novedades opera sobre `jovy_events` y su multimedia; la creación y el ciclo editorial del evento siguen en Eventos Jovy. |
| Dashboard | Métricas de analítica + accesos | El tablero muestra conteos reales del CMS y accesos; la analítica web quedó fuera porque no existe una fuente aprobada. |

## Funciones históricas sin pantalla propia

Estas capacidades no corresponden a una de las 13 opciones, pero condicionan la paridad y se
declaran aquí para no contarlas dos veces:

| Función histórica | Destino actual | Estado | Evidencia / límite |
| --- | --- | --- | --- |
| Roles y permisos internos (RBAC) | Medusa RBAC (Enterprise) | `Bloqueada por decisión comercial/licencia` | `@medusajs/rbac` existe en 2.22.6 pero no está registrado ni licenciado. `authorize`/`hasPermission` son no-op. Recursos, roles y alternativa sin licencia: **diseño no implementado** en `docs/19` y `docs/30`. |
| Analítica de dashboard (visitas, productos top) | UI declarativa sin fuente | `Pendiente` | No hay código de analytics; el tablero muestra «No disponible: falta fuente analítica». `docs/13` la excluyó hasta definir fuente y privacidad. |
| Exportación CSV/XLSX de solicitudes | `GET /admin/jovy/contacts/export` | `Completa funcional (sin paridad visual)` | CSV por bandeja, límite de 5 000 filas, escaping y auditoría por logger. No hay XLSX. |
| Restauración de CMS más allá de la ficha editorial | `POST /admin/jovy/products/:id/editorial/restore` y `POST /admin/jovy/contacts/:id/restore` | `Funcionalmente parcial` | Lanzamientos y familias de catálogo tienen soft delete **sin restore expuesto**. Páginas, Hero, banners, galería, logos y tipos de evento se borran **físicamente**, así que no hay fila que restaurar. Eventos usa soft delete desde el fix de backend, sin restore expuesto. |
| Borrado de medios y conteo de referencias | Ninguno | `Pendiente` | Solo POST/GET de medios; sin DELETE ni conteo. |
| Gestión de familias de producto desde Admin | API `GET/POST/PUT/DELETE /admin/jovy/catalogue/families*` | `Implementada, pero no visible` | La UI de catálogo solo lista familias; no hay formulario de alta/edición/borrado. La asignación producto↔familia tampoco tiene endpoint: hoy solo la resuelve el script de compatibilidad (`docs/27` §7). |

## Resumen de conteos por estado

Pantallas históricas (13 filas de la matriz):

| Estado | Total |
| --- | ---: |
| `Completa funcional (sin paridad visual)` | 6 |
| `Funcionalmente parcial` | 6 |
| `Implementada, pero no visible` | 0 |
| `Pendiente` | 0 |
| `Sustituida por Medusa nativo` | 0 |
| `Bloqueada por decisión comercial/licencia` | 1 |
| **Total** | **13** |

Funciones sin pantalla propia (6 filas auxiliares):

| Estado | Total |
| --- | ---: |
| `Completa funcional (sin paridad visual)` | 1 |
| `Funcionalmente parcial` | 1 |
| `Implementada, pero no visible` | 1 |
| `Pendiente` | 2 |
| `Sustituida por Medusa nativo` | 0 |
| `Bloqueada por decisión comercial/licencia` | 1 |
| **Total** | **6** |

Total de la matriz (19 filas):

| Estado | Total |
| --- | ---: |
| `Completa funcional (sin paridad visual)` | 7 |
| `Funcionalmente parcial` | 7 |
| `Implementada, pero no visible` | 1 |
| `Pendiente` | 2 |
| `Sustituida por Medusa nativo` | 0 |
| `Bloqueada por decisión comercial/licencia` | 2 |
| **Total** | **19** |

Lectura honesta del resumen:

- Las 6 pantallas con estado `Completa funcional (sin paridad visual)` son las que tienen función
  histórica cubierta y spec E2E propia: Categorías del catálogo, Galería y las cuatro bandejas de
  solicitudes. **No** son réplicas visuales aceptadas. Con la ejecución real del 2026-11-17,
  Categorías y Galería tienen par contra el histórico real (Galería solo en listado 1440); las
  cuatro bandejas siguen pendientes de comparación en `docs/29`, bloqueadas por PII.
- Las 6 parciales no son «pantallas rotas»: son pantallas usables con una brecha concreta
  (analítica ausente en Dashboard, DnD/paginación en Productos, DnD en Lanzamientos, DnD/rutas de
  Logos, crop de Anuncios y restore/URL en Novedades). Cada brecha está nombrada en la fila.
- `Bloqueada por decisión comercial/licencia` se usa para Usuarios: el CRUD nativo existe, pero los
  roles, estados, bloqueo y hard delete históricos dependen de RBAC Enterprise no licenciado.
- La parte realmente nativa (producto comercial, categorías comerciales, imágenes, precios, stock)
  está descrita en la fila 2 y en `docs/24` P5, P6 y P10.
- `Implementada, pero no visible` se usa solo para la gestión de familias, que tiene API pero no
  formulario en pantalla.
- Esta tabla juzga **funcionalidad de pantalla**, no fidelidad visual. `docs/29` registra ocho
  comparaciones contra el admin histórico real ejecutado; Usuarios está `PENDIENTE DE COMPARACIÓN
  (BLOQUEADO POR PII)`, y las cuatro bandejas siguen pendientes, también bloqueadas por PII; esta matriz mantiene Usuarios en
  `No replicable en extensión` por RBAC. Renombrar el estado no sube la paridad visual ni implica
  fidelidad total.

## Regresión usada como evidencia

Corrida consolidada del 2026-11-17 (registrada en `docs/21` y `docs/29`):

| Comprobación | Resultado |
| --- | --- |
| `pnpm lint` | 0 |
| `pnpm typecheck` | 0 |
| `test:unit` | 32 suites / 328 pruebas |
| `test:integration:modules` | 6 suites / 37 pruebas |
| `test:integration:http` | 11 suites / 76 pruebas |
| `pnpm build` | OK |
| `test:e2e` | 29 pruebas / 0 fallos / 4,1 min en un solo comando |

Specs E2E (14): `content`, `hero`, `banners`, `events`, `brand`, `brand-families`, `contacts`,
`contact-inboxes`, `cms-navigation`, `catalogue-admin`, `launches-admin`, `announcements-admin`,
`novelties` y `product-editorial`.

Capturas de auditoría: `apps/backend/.test-results/audit-visual/{categories,dashboard,products,
logos,announcements,novelties,gallery,launches,contacts}/`; capturas anteriores en
`apps/backend/.test-results/audit-final/`. La fase del 2026-11-17 añadió pares en
`apps/backend/.test-results/audit-visual-pair/{historical,current,comparisons}/`; el lado
«histórico» es una reconstrucción aislada DEMO, evidencia complementaria. Esa misma fecha añadió
las capturas auténticas en `.../historical-real/` y los pares en `.../comparisons-real/` (etiquetas
«HISTÓRICO REAL · servidor local · login real»), del admin histórico ejecutado en localhost con
MySQL local y login real. Todas esas rutas están ignoradas por Git.

## Límites de esta auditoría

- No se re-ejecutaron pruebas en esta revisión; los conteos provienen de la verificación del
  2026-11-17 registrada en `docs/21` y `docs/29`.
- La fase del 2026-11-17 ejecutó el admin histórico real (localhost, MySQL local, login real,
  capturas con `browse`) y comparó ocho pantallas: seis prioritarias, Galería (solo listado 1440)
  y Dashboard (1440, con composite `dashboard-1440`). Quedan diferencias visibles (tema
  oscuro/claro del shell, switch «Próximamente» corregido, zoom y texto de ayuda en el modal de
  logos, jerarquía de anuncios, densidad de novedades, grid de productos), por lo que **no se afirma
  fidelidad total**. Usuarios está `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)` y las cuatro
  bandejas siguen pendientes, también bloqueadas por PII; falta el inventario de estados (errores, formularios de creación
  completos y algún modal).
- No hay E2E del Admin nativo (`Products`, `Categories`, `Orders`, `Customers`, `Settings`); su
  paridad se acepta como capacidad nativa, no como validación del repositorio.
- No se verificó el comportamiento real del storefront: esta matriz juzga el Admin y sus APIs.
- La analítica histórica no se puede comparar porque su fuente no existe en el proyecto.
- El RBAC no se probó porque no está registrado; la afirmación «cualquier usuario autenticado es
  admin pleno» viene de `docs/19` y del código de `api/middlewares.ts`, no de una prueba de
  denegación ejecutada.
