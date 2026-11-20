# Estado — reescritura administrativa en Medusa

**Corte:** 2026-11-14. **Nota 2026-11-17:** se ejecutó el admin histórico real en localhost
(MySQL local, login real, capturas con `browse`) y la fase de fidelidad visual comparó ocho
pantallas contra él (las seis prioritarias, Galería —solo listado 1440— y Dashboard —1440, con
composite `dashboard-1440`—); Usuarios queda `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)` y las
cuatro bandejas siguen pendientes, también bloqueadas por PII (su captura histórica contiene datos
personales reales); la copia aislada DEMO queda como evidencia complementaria. **Alcance:** `apps/backend` (Medusa 2.22.6), módulos
`jovy-*`, Admin propio y APIs Store. Lo que no tiene evidencia ejecutada se declara pendiente.
No se declara fidelidad total: persisten diferencias visibles; ver
`docs/29-PARIDAD-VISUAL-FUNCIONAL-CMS.md`.

**Nota de cierre (2026-11-17):** el menú «JovyCandy CMS» tiene **11 entradas**; Productos y
Usuarios son solo superficies nativas (`/app/products` y `/app/settings/users`) y las rutas
`/app/jovy/products` y `/app/jovy/users` ya no existen. Modalidad comercial y modelo de
permisos (diseño no implementado) en
`docs/30-MODELO-COMERCIAL-Y-PERMISOS.md`.

## Estado por área

| Área | Estado real | Evidencia verificable | Pendiente concreto |
| --- | --- | --- | --- |
| PostgreSQL y migraciones Medusa | IMPLEMENTADO Y VALIDADO | `medusa db:migrate` contra `jovycandy_prototipo_medusa`; migraciones de Content, Marketing, Events (`20261113090000`, `20261113093000`), Brand, Contacts, Catalogue (`20261113150000`), Launches (`20261113151000`), Announcements (`20261113152000`) y Product Editorial (`20261113180000`) aplicadas sin reinicializar la base | Ninguno de infraestructura local. Las migraciones son append-only. |
| Contenido editorial | IMPLEMENTADO Y VALIDADO | E2E `jovy-content.spec.ts`: login, validación, alta, duplicado, edición, publicación, Store API, archivado, auditoría y borrado físico sin restore | UI de SEO y `published_at`; ver matriz `docs/24`. |
| Marketing: Hero | IMPLEMENTADO Y VALIDADO | E2E `jovy-hero.spec.ts`: negativos HTTP, PNG/JPEG/WebP reales, >5 MB/SVG/firma falsa/MIME incoherente/PNG corrupto/sin archivo, persistencia de media y color global, reorden visible en Store, Product Link A→B→null idempotente con compensación | Assert explícito de `cta_url` y de color por elemento en E2E. |
| Banners de portada | IMPLEMENTADO Y VALIDADO | CRUD unificado en Anuncios de portada (`/app/jovy/announcements`): un solo gestor para `promo` (modal de entrada) y `hint` (bajo el logo) con selector de lugar; E2E `jovy-banners.spec.ts`: slots, prioridad/orden, frecuencia incluida `once`, `rotation_seconds`, ventana UTC, `auto_open`, CTA, negativos `400`, edición, archivo y reordenamiento desde UI | El storefront aún no interpreta `frequency`, `auto_open` ni `rotation_seconds`; es decisión de presentación (`docs/25`). |
| Eventos | IMPLEMENTADO Y VALIDADO | E2E `jovy-events.spec.ts`: gate de publicación, `title_en`, `cancelled`/futuro/pasado fuera de Store, tipos con GET/PUT/DELETE y bloqueo de borrado en uso, multimedia PNG/JPEG con reemplazo/retiro, reorden restringido por prioridad | Prueba de concurrencia del `code` único de tipos; detalle Store por `slug` y "próximos eventos" (`docs/25`). |
| Galería Casa Jovy y Logos | IMPLEMENTADO Y VALIDADO | E2E `jovy-brand.spec.ts` y `jovy-brand-families.spec.ts`; integración con Locking Module PostgreSQL: límite de 4 con concurrencia, ventanas cerradas `[start,end]`, bordes exactos, 5.º rechazado también por update; crop no destructivo, archivado/desactivación sin borrar medios compartidos, `media_file_id` inexistente → `NOT_FOUND`; relación real logo↔familia (`jovy_brand_logo_family`) con selector por categoría y Store filtrado; tope defensivo de 4 en lectura Store con warning sin PII. La ola añade carga múltiple secuencial, contador `n/4`, agenda/solapes, lightbox, confirmaciones de carga/reorden/borrado y E2E de reorden con persistencia y borrado con confirmación; logos pasa a grid 1/2/4, formulario separado, recorte en modal accesible (`role=dialog`, portal, foco/Escape, borrador local, zoom 0.5–2 y cuadrícula de tercios) con `jovy_brand_logo.crop` persistente y confirmaciones de crear/guardar/activar/reordenar/eliminar; carril propio de 20 MB para PNG/JPEG/WebP/GIF con SVG bloqueado por XSS, carril general en 5 MB | Logos: DnD contextual, rutas históricas separadas de alta/edición y reorden con E2E propio. Sin borrado físico de medios compartidos. |
| Contactos | IMPLEMENTADO Y VALIDADO | Cuatro bandejas planas más la vista consolidada `/app/jovy-herramientas/contacts` sobre una sola tabla y `features/contacts/components/contact-inbox.tsx`; tabla de seis columnas, tabs Todos/Pendiente/Atendido/Papelera con counts reales, búsqueda por nombre/apellido/email/teléfono/ciudad/país/CP, filtros de fecha, páginas 10/20/50, detalle/edición/auditoría en modales, atender/volver, soft delete + restore, export CSV/XLSX por bandeja, libro XLSX consolidado y polling cada 30 s; E2E `jovy-contact-inboxes.spec.ts` (bandejas, filtros, modales, papelera y exportación CSV/Excel) y `jovy-contacts.spec.ts`; integración `contacts-admin.spec.ts` y `contacts-query.integration.test.ts`: filtros SQL con escape de `%`/`_`, `limit` 10/20/50, envelope `{contacts,count,limit,offset}`, `429` con `Retry-After`, soft delete, restore y auditoría con whitelist; migración `Migration20261114120000` amplía las acciones `restore` y `update`; endpoints `POST /admin/jovy/contacts/:id/restore`, `GET /admin/jovy/contacts/export` y `GET /admin/jovy/contacts/export-all`; counts agrupa `deleted_at` y devuelve `{pending,handled,deleted,total}`; `PUT` acepta campos del remitente y operativos, y rechaza `id`, `contact_type`, `message` y desconocidos | Rate limit en memoria (solo laboratorio); sin purga física ni anonimización automática (`docs/26-RETENCION-CONTACTOS.md`); exportación acotada a 5 000 filas por petición, compartida por el libro consolidado. |
| Dashboard y navegación CMS | IMPLEMENTADO Y VALIDADO | `src/admin/routes/jovy/page.tsx` (`label: "JovyCandy CMS"`, icono `SquaresPlus`, `rank: 0`); H1 «Dashboard» y marca «JovyCandy CMS»; KPIs en grilla 1/3 responsive con conteos reales; rangos 7/30/90/personalizado y refresco automático cada 60 s pausado en pestaña oculta; `GET /admin/jovy/dashboard` responde `401` sin sesión y `200` con conteos reales; E2E `jovy-cms-navigation.spec.ts` valida la entrada del sidebar, el tablero, las tarjetas de acceso y la ausencia de PII; capturas en `.test-results/audit-visual/dashboard/` y `.test-results/audit-final/` | Analítica histórica (`page_views`, productos top) no existe y no se simula: la sección declara «No disponible: falta fuente analítica»; los rangos no alteran los conteos. |
| Categorías del catálogo | IMPLEMENTADO Y VALIDADO | Módulo `jovy_catalogue`; 6 tarjetas fijas (`sazonador`, `chamoy`, `gomitas_almidon`, `dulces_paletas`, `pinatero`, `gomitas_grenetina`); campos `name`, `description`, `key`, `active`, `coming_soon`, `interaction_locked`, imagen, `medusa_category_id`, orden; seed manual idempotente; UI con seis tarjetas en grid 1/3, formulario separado `lg` 8/4, apilado móvil y confirmación `usePrompt`; backend normaliza `coming_soon => active=false + interaction_locked=true` y desmarcarlo reactiva y desbloquea; `GET /store/jovy/catalogue/categories` devuelve `active` y las familias Store ocultan categorías no publicables o bloqueadas; E2E `jovy-catalogue-admin.spec.ts` (seis tarjetas, proporción 8/4, edición, «Próximamente» y reactivación, imagen, reorden, vínculo comercial, ocultar en Store) | Sin alta ni borrado por diseño (claves fijas); auditoría en módulos nuevos pendiente. |
| Nuevos lanzamientos | IMPLEMENTADO Y VALIDADO | Módulo `jovy_launches` (`jovy_launch`, `jovy_launch_settings`); CRUD, orden, `active`, producto Medusa e imagen; color global `#00AFAA`; UI con tarjetas 1/2/4, modal histórico de alta/edición (portal, `role=dialog`, foco/Escape, «Nuevo Slide», «Opciones adicionales» plegables), ocho presets + hex y confirmaciones de color/eliminar; E2E `jovy-launches-admin.spec.ts` (producto, imagen, orden, visibilidad, preset, hex válido e inválido) | DnD histórico no replicado; el orden usa flechas. Auditoría en módulos nuevos pendiente. |
| Anuncios de portada | IMPLEMENTADO Y VALIDADO | `/app/jovy/announcements` es el único CRUD de los dos tipos de banner (`promo` modal de entrada y `hint` bajo el logo); migración `Migration20261119133346` añade `rotation_seconds` 3–60 y `frequency` `once`; E2E `jovy-announcements-admin.spec.ts` (selector de lugar, formulario, badges, filtro por tipo, persistencia, Store) y `jovy-banners.spec.ts`. El mensaje corporativo ES/EN (`jovy_announcement_settings`) se administra en Marketing Jovy (`CorporateMessagePanel` + `CorporateMessageForm`), bajo el Hero, cuya E2E vive en `jovy-hero.spec.ts` | El mensaje editable es nuevo y solicitado; el histórico solo tenía texto hardcodeado. El crop de banner sigue pendiente porque el backend no persiste `crop_zoom`/offsets. |
| Novedades | IMPLEMENTADO Y VALIDADO | `/app/jovy/novelties`: grid multimedia 1/2/3/5 sobre `jovy_events` (misma entidad histórica); imagen/GIF/video (límite 100 MB con firma real), búsqueda/filtros de estado, tipo y activo, preview, reemplazo/retiro, prioridad/orden, enlace al evento exacto y confirmaciones; E2E `jovy-novelties.spec.ts` con WebM real y borrador | Sin restauración de eventos ni medio por URL externa; el alta/borrado del evento sigue en Eventos Jovy, donde el borrado es lógico desde el fix de backend; su restore aún no está expuesto. Streaming de video con `file-local` no soporta `Range`: se sirve el archivo completo. |
| Productos editoriales | IMPLEMENTADO Y VALIDADO | Módulo `jovy-product-editorial` (`product_id` único); widget `product.details` «Ficha editorial Jovy» agrupado, con confirmaciones de guardar, restaurar, publicar, archivar y eliminar; edición exclusiva vía widget `product.details` en el detalle nativo; agregado en `GET /admin/jovy/products/editorial`; gramaje, certificaciones SGS/OU Kosher/Halal, `is_new`, `sort_order`, estado editorial y publicar/archivar/restaurar; Store `/store/jovy/products`; E2E `jovy-product-editorial.spec.ts`. `published_at` es set-once y el Store solo publica fichas `published` cuyo producto comercial siga `published`. No duplica SKU, precio, stock ni variantes. Modalidad `commercial_mode` (`catalog_only`/`sellable`/null; null ⇒ `CATALOG_ONLY`, sin backfill) con migración `Migration20261117120000` aplicada en local el 2026-11-17; hooks `validate` del carrito en `src/workflows/hooks/jovy-commercial-mode.ts` rechazan con `MedusaError(NOT_ALLOWED)` lo que no sea `SELLABLE`; `/store/jovy/products` expone la modalidad derivada sin precios ni inventario. | Asignación manual producto↔familia desde Admin (la API de familias existe, la UI solo lista); DnD y paginación backend no existen; auditoría de módulos nuevos pendiente. |
| RBAC fino / roles | BLOQUEADO POR LICENCIA | `@medusajs/rbac` existe en 2.22.6 como dependencia transitiva, es Enterprise y no está licenciado ni registrado en `medusa-config.ts`; `authorize`/`hasPermission` son no-op, rutas `/rbac/*` desactivadas. Recursos, roles y alternativa sin licencia: **diseño NO IMPLEMENTADO** en `docs/19-SEGURIDAD-ADMIN.md` y `docs/30-MODELO-COMERCIAL-Y-PERMISOS.md` | Decisión comercial: licenciar RBAC o aceptar que todo `user` autenticado es admin pleno. No se simulan roles. |
| Medios | IMPLEMENTADO PARCIALMENTE | Ruta Admin con Multer en memoria (5 MB) para imágenes con firma, MIME y `sharp`; ruta de video de eventos (≤100 MB, firma MP4/WebM, `media_type`); E2E de subida de imagen y video, unit de firmas y límites | Sin `DELETE`, sin conteo de referencias, sin transcode ni `Range`; los archivos locales son públicos. |
| Store API y publishable key | IMPLEMENTADO Y VALIDADO | E2E de las catorce specs / 29 pruebas (confirmada el 2026-11-17), que ejercitan `/store/jovy/*` donde aplica; sin key la respuesta es `400` antes del handler | Cerrar los gaps de contrato de `docs/25` (producto destacado, detalle de evento, paginación). |
| Paridad con el administrador histórico | AUDITADA | `docs/24-MATRIZ-PARIDAD-ADMIN.md` (74 filas funcionales: 49 validadas, 12 parciales, 6 nativas, 4 pendientes, 3 descartadas); `docs/28-MATRIZ-PARIDAD-PANTALLAS.md` (13 pantallas: 6 completas funcionales sin paridad visual, 6 parciales, 1 bloqueada por licencia); `docs/29-PARIDAD-VISUAL-FUNCIONAL-CMS.md` (8 pantallas comparadas contra el admin histórico real en localhost con login real: 6 prioritarias, Galería —solo listado 1440— y Dashboard —1440, con composite `dashboard-1440`—; Usuarios queda `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)` porque su captura histórica contiene correos y nombres reales del administrador antiguo y no se replica en composites; 4 Solicitudes siguen pendientes y bloqueadas por PII, con captura histórica única sin distinción por tipo que contiene datos personales reales y no se propaga; la copia aislada DEMO es evidencia complementaria) | **No es una réplica aceptada**: la ejecución real reduce la incertidumbre, pero los modales de logos y lanzamientos ya están reproducidos; quedan diferencias visibles (tema oscuro/claro del shell, switch «Próximamente» corregido, zoom y texto de ayuda en el modal de logos, jerarquía de anuncios, densidad de novedades, grid de productos). Pendiente: estados no cubiertos, RBAC, crop de banner, DnD de logos/lanzamientos, restore de eventos, rutas separadas de logos, analítica y asignación producto↔familia. |

## Bandejas de contactos (Bloque 7)

`src/admin/routes/jovy/contacts-{national-sales,international-sales,customer-service,catalogue}/`
expone una ruta plana por bandeja, más la vista consolidada `/app/jovy-herramientas/contacts`. Las cinco
reutilizan `src/admin/features/contacts/components/contact-inbox.tsx` y la misma API
`/admin/jovy/contacts`; no existen tablas ni módulos por bandeja.

- El tipo de una bandeja fija se envía siempre en la consulta y el backend lo valida con
  `contactListQuerySchema` (`z.enum`); un valor fuera del enum responde `400`.
- Los contadores provienen de `GET /admin/jovy/contacts/counts`, una agregación SQL por
  `contact_type`, `status` y `deleted_at` que devuelve `{pending,handled,deleted,total}` y no
  carga filas.
- El detalle muestra todos los campos del modelo (`phone`, `country`, `city`, `postal_code`,
  `handled_at`, `handled_by`, `admin_notes`) y la auditoría sin PII. `PUT /admin/jovy/contacts/:id`
  acepta `first_name`, `last_name`, `email`, `phone`, `country`, `city`, `postal_code`, `status` y
  `admin_notes`; rechaza `id`, `contact_type`, `message` y campos desconocidos.
- La tabla replica las seis columnas históricas (Fecha, Cliente, Contacto, Ubicación, Mensaje,
  Acciones) y añade tabs Todos/Pendiente/Atendido/Papelera, búsqueda por nombre/apellido/email/
  teléfono/ciudad/país/CP, filtros `date_from`/`date_to`, páginas 10/20/50, modales de detalle,
  edición y auditoría, atender/volver, soft delete + restore y polling cada 30 s.
- `GET /admin/jovy/contacts/export` exporta **CSV o XLSX** de una sola bandeja (`contact_type`
  obligatorio, `format=csv|xlsx`), reutiliza los filtros de la lista, limita a 5 000 filas, escapa
  fórmulas y comillas, usa UTF-8 con BOM/CRLF para CSV y registra la operación en el logger con
  bandeja, formato, filas, actor y filtros (sin término de búsqueda ni PII).
- `GET /admin/jovy/contacts/export-all` genera un libro XLSX con una hoja por bandeja
  (`contact_types` separado por comas; omitido = las cuatro). Comparte el tope de 5 000 filas y
  devuelve `X-Export-Count` y `X-Export-Sheets`; la vista consolidada lo expone como «Exportar todo
  (Excel)».
- `POST /admin/jovy/contacts/:id/restore` es idempotente: una solicitud viva vuelve sin cambios y no
  escribe auditoría. La migración append-only `Migration20261114120000` amplía el check de
  `jovy_contact_audit_log.action` con `restore` y `update`.
- **Anidación en Medusa 2.22.6:** Medusa anida automáticamente las rutas hijas bajo el padre
  `/app/jovy`; el campo oficial `nested` solo admite rutas nativas, no `/jovy/*`. Por eso no se
  puede tener `/app/jovy-herramientas/contacts/catalogue` como hija visible sin duplicar entradas. Cada bandeja
  vive en una ruta plana que el menú enlaza y renderiza `<ContactInbox contactType=…>`
  directamente: sin redirects, sin stubs y sin entradas duplicadas. El prefijo `contacts-` evita
  que `/app/jovy/contacts-catalogue` choque con `/app/jovy/catalogue`, que pertenece al catálogo.
- La vista consolidada `/app/jovy-herramientas/contacts` («Contactos Jovy», rank 5) lista los cuatro tipos y
  comparte búsqueda y contadores; el E2E la valida con cuatro filas y búsqueda común.

**Nota de navegación (2026-11-17):** en la ola de fidelidad el sidebar «JovyCandy CMS» reproducía
las 13 entradas históricas; el **estado vigente** tiene **11 entradas** (Dashboard
`/app/jovy/dashboard`, Categorías, Nuevos Lanzamientos, Casa Jovy Galería, Logos
`/app/jovy/logos`, Anuncios de portada, Novedades y las cuatro bandejas `/app/jovy/contacts-*`,
la última «Catálogo — Solicitudes»). `/app/jovy/products` y `/app/jovy/users` ya no existen:
Productos y Usuarios son solo nativos. Las cuatro funciones aditivas (Contenido, Marketing,
Eventos y Contactos consolidados) están en el grupo hermano «JovyCandy · Herramientas» bajo
`/app/jovy-herramientas/{content,events,marketing,contacts}`; sus componentes compartidos se importan
con rutas relativas porque el Vite del Admin no resuelve el alias `@jovy/*`. Ver `docs/28`, `docs/29`
y `docs/30`.

## Regresión consolidada

Re-ejecutada parcialmente el 2026-11-17 sobre el árbol de trabajo, sin commits nuevos:

| Comprobación | Resultado |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | 0 en la verificación final del 2026-11-17. |
| `pnpm --dir apps/backend test:unit` | 32 suites / 328 pruebas OK |
| `pnpm --dir apps/backend test:integration:modules` | 6 suites / 37 pruebas OK |
| `pnpm --dir apps/backend test:integration:http` | 11 suites / 76 pruebas OK |
| `pnpm build` | OK en la verificación final del 2026-11-17. |
| `pnpm --dir apps/backend test:e2e` | 29/29 sin flaky en 4,1 min, corrida final agrupada y secuencial del 2026-11-17 |

- Playwright agrupado quedó verde en la corrida confirmada del 2026-11-17: 29/29 pruebas con las catorce
  specs (`content`, `hero`, `banners`, `events`, `brand`, `brand-families`, `contacts`,
  `contact-inboxes`, `cms-navigation`, `catalogue-admin`, `launches-admin`,
  `announcements-admin`, `novelties`, `product-editorial`); incluye el test nuevo de filtros de
  logos.
- `test:integration:http` cubre contactos Store/Admin/rate limit/export/restore, contenido Store,
  marketing Store/Hero/Banners, eventos y multimedia, y catálogo/lanzamientos/anuncios, contra bases
  desechables.
- `test:integration:modules` incluye `jovy-brand`, `jovy-contacts`, `jovy-catalogue`,
  `jovy-launches` y `jovy-product-editorial` contra PostgreSQL real; usa bases desechables de
  `@medusajs/test-utils`.
- Capturas de auditoría de esta ola en `.test-results/audit-visual/` (categorías, dashboard,
  productos, logos, anuncios, novedades, galería, lanzamientos y contactos) y capturas anteriores en
  `.test-results/audit-final/`. Todas están ignoradas por Git; las capturas del Admin histórico
  real y sus composites viven en `.test-results/audit-visual-pair/{historical-real,comparisons-real}/`,
  también ignoradas.

## Playwright: causa raíz y corrección

Causa demostrada: el watcher de `medusa develop` reinicia el servidor ante cualquier archivo
escrito bajo `apps/backend` que no esté en su lista ignorada (`node_modules`, `dist`, `static`,
`private`, `src/admin`, `.medusa`, dotfiles). Playwright escribía capturas, trazas y reportes en
`test-results/` y `playwright-report/`; el reinicio mataba el proceso hijo del puerto 9001 y las
pruebas siguientes fallaban con `ECONNRESET`/`ECONNREFUSED`.

Corrección aplicada en `apps/backend/playwright.config.ts`:

- Artefactos en `.test-results/playwright` y `.playwright-report` (dotfiles ignorados por el watcher).
- `PLAYWRIGHT_BROWSER_EXECUTABLE` tiene prioridad; si no está definido se buscan las rutas de
  instalación de Brave y se documenta el fallback.
- Dos flakes reales corregidos: `expect.poll` en Brand y verificación del badge persistente en
  Contactos.
- `workers: 1` se mantiene porque PostgreSQL es compartido.
- La suite completa son 14 specs / 29 pruebas; las capturas se escriben en dotfiles
  (`.test-results/<bloque>/`) que el watcher ignora.

## Seguridad y RBAC

Gap real: Medusa 2.22.6 incluye `@medusajs/rbac`, pero es una capacidad **Enterprise** que el
proyecto no tiene licenciada ni registrada en `medusa-config.ts`. Sin registro, `authorize` no hace
nada y `hasPermission` devuelve `true`: toda sesión `user` o API key secreta es admin pleno sobre
contenido, marketing, eventos, marca, catálogo, lanzamientos, anuncios, novedades, producto
editorial, contactos (incluida PII) y configuración. El diseño de recursos `jovy_*`, roles
propuestos y guardas por ruta está documentado en `docs/19-SEGURIDAD-ADMIN.md`; **no se
implementó** y **no se simulan roles** para no aparentar una seguridad que la licencia no permite.

Si el negocio licencia RBAC, el trabajo pendiente es: registrar el módulo, ejecutar migraciones,
crear políticas de dominio, reasignar usuarios fuera de Super Admin, añadir `authorize` por
método/ruta y probar denegaciones. También siguen abiertos el rate limit compartido de contactos,
el filtrado de campos PII y el tratamiento de API keys como credenciales de máquina. Detalle y
hallazgos: `docs/19`.

## Paridad

Resumen funcional de `docs/24-MATRIZ-PARIDAD-ADMIN.md`: 74 filas auditadas; 49 implementadas y
validadas, 12 parciales, 6 resueltas por Medusa nativo, 4 pendientes y 3 descartadas
justificadamente. Resumen por pantalla de `docs/28-MATRIZ-PARIDAD-PANTALLAS.md`: de las 13 opciones
históricas, 6 están completas **funcionalmente** (Categorías del catálogo, Galería y las cuatro
bandejas de solicitudes), 6 son funcionalmente parciales (Dashboard, Productos, Nuevos lanzamientos,
Logos, Anuncios y Novedades) y 1 está bloqueada por decisión comercial/licencia (Usuarios). Ese
estado se llama `Completa funcional (sin paridad visual)` y **no** es una réplica aceptada. `docs/29`
registra ahora **ocho pantallas comparadas contra el admin histórico real ejecutado en localhost
con login real** (seis prioritarias, Galería —solo listado 1440— y Dashboard —1440, con composite
`dashboard-1440`—); la copia aislada DEMO queda como evidencia complementaria. Usuarios está
`PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)`: su captura histórica contiene correos y nombres
reales del administrador antiguo y no se replica en composites (bloqueo por privacidad, no por
falta de captura). Las cuatro bandejas siguen pendientes, también bloqueadas por PII: su captura
histórica única sin distinción por tipo contiene datos personales reales (nombre completo, correo,
teléfono, ciudad/código postal y mensajes de clientes) y no se propaga. La matriz funcional mantiene
Usuarios en `No replicable en extensión` por RBAC.

Las brechas que bloquean paridad real ya no incluyen «producto editorial ausente» ni «exportación de
contactos ausente»: módulo, ficha, gate, restauración de ficha, export CSV, papelera y restore de
solicitudes existen y están validados. Quedan la asignación manual producto↔familia, el RBAC
(bloqueado por licencia), el ciclo de vida de medios (borrado y conteo), la retención/purga de
contactos, el rate limit compartido, la restauración fuera de ficha/contactos, el crop de banner, el
DnD de logos/lanzamientos, la analítica y la confirmación en la instancia histórica original. El detalle por fila y el conteo por
módulo están en `docs/24`; el detalle por pantalla, en `docs/28`; la honestidad visual, en
`docs/29`.

## Contratos para storefront

El contrato de consumo está en `docs/25-CONTRATOS-STOREFRONT.md`. Regla vigente: el storefront
consume **solo** `/store/jovy/*` (y rutas nativas `/store/*` cuando aplique). Está prohibido llamar
`/admin/jovy/*`: exige sesión, devuelve borradores, auditoría y PII.

Puntos consolidados del contrato: publishable key obligatoria; Eventos devuelve `title_en` y el
gate de publicación exige título ES, `title_en`, tipo existente, `starts_at` y rango coherente;
contacto responde `429` con `Retry-After`; las listas Store no paginan. Gaps abiertos (producto
destacado en Hero, detalle de evento por `slug`, "próximos eventos", paginación, `event_type`
completo) están en `docs/25` §9 y §10.

## Riesgos para producción

| Riesgo | Impacto | Estado |
| --- | --- | --- |
| RBAC apagado | Cualquier admin o API key accede a todo, incluida PII | Bloqueante |
| Sin purga ni anonimización de contactos | La restauración ya existe, pero la retención de `docs/26` sigue siendo manual | Bloqueante para cumplimiento de privacidad |
| Rate limit de contactos en memoria | Bypass por reinicio o múltiples instancias | Bloqueante si el formulario se expone |
| `file-local` público y sin `Range` | Archivos accesibles sin control; video se sirve completo | Bloqueante para medios privados |
| Sin borrado ni conteo de referencias de medios | Huérfanos y crecimiento no acotado | Pendiente, no bloqueante |
| Crop de banner no persistido | La UI no puede reproducir el encuadre histórico | Funcional, no de seguridad |
| DnD no replicado en logos/lanzamientos | Paridad de interacción sustituida por flechas | Funcional, no de seguridad |
| Eventos sin restauración expuesta | El borrado es lógico desde el fix de backend, pero Novedades no puede deshacerlo | Funcional |
| Contrato Store incompleto | Sin producto destacado, detalle de evento ni agenda futura | Funcional, no de seguridad |
| Despliegue no evaluado | No hay Docker, despliegue ni auditoría de CORS/secretos de producción | Fuera del alcance local |

## Estado de Git

- `HEAD` = `24ba74d` (`feat(admin): replica el CMS Jovy y consolida paridad funcional`).
- No se crearon commits ni se hizo push en esta fase documental.
- Árbol de trabajo con cambios sin commitear en código, specs y documentación de la fase de
  fidelidad visual (categorías, logos, anuncios, novedades, contactos, medios y sus pruebas).
- `docs/27`, `docs/28` y `docs/29` ya están versionados; `docs/21` y `docs/29` tienen cambios de
  esta fase sin commitear.
- `apps/backend/static/` es runtime del provider `file-local` y no se versiona.
- `.test-results/` (incluidas `audit-visual/` y `audit-final/`) está ignorado por Git y no forma
  parte del entregable.
