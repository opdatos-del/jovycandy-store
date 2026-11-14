# Paridad visual y funcional — CMS histórico y Admin Medusa

**Corte documental:** 2026-11-14. **Alcance:** comparación de las 13 opciones históricas
contra sus superficies actuales en Medusa. Este documento no certifica aceptación de
paridad ni sustituye pruebas visuales comparables.

**Relación con `docs/28`:** esa matriz usa el estado `Completa funcional (sin paridad visual)` para
seis pantallas porque su función histórica está cubierta y tienen E2E propio. Ese estado **no** es
una réplica aceptada ni sube la paridad visual: aquí las 12 pantallas replicables siguen en
`Parcial` y Usuarios en `No replicable en extensión` hasta que exista captura histórica pareada.

## Evidencia estática y capturas

- La evidencia histórica es estática y de solo lectura en `admin-webjovy`. Las
  referencias de cada fila son archivos verificados en ese repositorio; no se
  modificó, ejecutó, instaló ni actualizó el histórico.
- **No existen capturas del administrador histórico ejecutado.** No se tomó ninguna
  captura del histórico en esta ola ni en las anteriores; la única evidencia es de
  fuente read-only. Por eso ninguna pantalla puede declararse «réplica aceptada» ni
  con fidelidad visual validada por comparación pareada.
- Hay capturas Medusa locales de esta ola en `apps/backend/.test-results/audit-visual/`
  (por área) y capturas anteriores en `apps/backend/.test-results/audit-final/`.
  Ambas rutas están ignoradas por Git y no se versionan.
- La captura histórica comparable sigue **pendiente** de una ejecución en modo de
  solo lectura, sin instalar, actualizar, escribir datos ni alterar configuración.
- `No evaluada` significa que no existe evidencia de comparación visual o de
  ejecución comparable para ese punto. `Parcial` significa que la funcionalidad y la
  UI están reproducidas y cubiertas por pruebas del repositorio en su ciclo
  principal, pero falta la comparación visual pareada histórica y/o queda una
  diferencia funcional explícita. `No replicable en extensión` identifica una
  función cuyo equivalente depende de una extensión o licencia no disponible; no
  equivale a aceptación ni a aprobación.

Referencias de contexto: [matriz por pantalla](28-MATRIZ-PARIDAD-PANTALLAS.md),
[seguridad y RBAC](19-SEGURIDAD-ADMIN.md),
[marketing, medios y marca](23-MARKETING-CONTENT.md) y
[matriz técnica por funcionalidad](24-MATRIZ-PARIDAD-ADMIN.md).

## Matriz de 13 pantallas

| Pantalla | Referencia histórica | Captura Medusa | Estructura equivalente | Campos equivalentes | Interacciones equivalentes | Diferencias | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | `frontend/src/pages/Dashboard.tsx`; KPIs de visitas y ranking, rangos 7/30/90/personalizado y refresco de 30 s. | Parcial: `audit-visual/dashboard/`, `audit-final/03-dashboard.png`, `audit-final/20-dashboard-recargado.png`. Histórica: `No evaluada`. | Reproducida: `/app/jovy` con H1 «Dashboard», marca «JovyCandy CMS», KPIs de conteo en grilla 1/3 responsive, secciones operativas y bloque de analítica separado. | Reproducidos los conteos reales del CMS y la fecha de generación. Los rangos 7/30/90/personalizado existen como selector de periodo, pero no hay fuente de visitas, aperturas ni top de productos. | Refresco manual más refresco automático cada 60 s, pausado en pestaña oculta; el rango solo describe el periodo y no altera los conteos. Enlaces a cada pantalla operativa. | La analítica histórica muestra «No disponible: falta fuente analítica» en lugar de ceros o cifras estimadas. El intervalo es 60 s, no 30 s. | Parcial |
| Productos | `frontend/src/pages/ProductsList.tsx`, `ProductForm.tsx`; grid, rutas/formularios propios y DnD. | Parcial: `audit-visual/products/`, `audit-final/04-productos.png`, `05-producto-detalle.png`, `05b-widget-editorial.png`, `19b-productos-editoriales.png`. Histórica: `No evaluada`. | Reproducida: `/app/jovy/products` con listado de tarjetas 1/2/3/4/5 columnas, búsqueda y filtros; el detalle comercial sigue siendo el producto nativo con widget editorial agrupado. | Ficha editorial con gramaje, certificaciones, `is_new`, `sort_order` y estado; datos comerciales (SKU, precio, stock, variantes, imágenes) permanecen en Product Module. | Búsqueda, filtros, edición de ficha, orden, y confirmaciones de guardar, restaurar, publicar, archivar y eliminar. Sin DnD ni paginación: el listado backend no pagina. | Separación arquitectónica deliberada para no duplicar Product Module. El DnD histórico no se replica; el orden se edita con control numérico y flechas. | Parcial |
| Categorías | `frontend/src/pages/CategoriesList.tsx`, `CategoryForm.tsx`; seis tarjetas 1→3, formulario 8/4 en `lg`, paleta, toggle y confirmaciones. | Parcial: `audit-visual/categories/`, `audit-final/06-catalogo.png`, `06c-catalogo-inferior.png`, `06d-catalogo-final.png`, `06e-catalogo-6-tarjetas.png`. Histórica: `No evaluada`. | Reproducida: seis tarjetas en grid 1/3, formulario separado con contenido `lg:col-span-8`, configuración `lg:col-span-4` y apilado móvil. | Nombre, descripción, orden, imagen, `active`, `coming_soon`, `interaction_locked` y vínculo comercial `medusa_category_id`. | Edición en formulario separado, confirmación con `usePrompt`, reordenamiento y seed de claves ausentes. «Próximamente» fuerza `active=false` e `interaction_locked=true`; desmarcarlo vuelve a publicar y desbloquear, como el histórico. | Sin alta ni borrado: las seis claves son fijas. La paleta de acento por clave se replica en la tarjeta. El backend normaliza la invariante y el Store devuelve `active`; las familias Store ocultan categorías no publicables o bloqueadas. Falta comparación visual pareada. | Parcial |
| Nuevos lanzamientos | `frontend/src/pages/NewReleasesProductsList.tsx`, `NewReleasesProductForm.tsx`; modal `xl`, grid de cuatro columnas, DnD, flechas y presets + picker hex. | Parcial: `audit-visual/launches/`, `audit-final/07-lanzamientos.png`. Histórica: `No evaluada`. | Reproducida: listado de tarjetas 1/2/4 columnas y formulario separado de la lista. | Producto, imagen, orden, `active` y color global; ocho presets de color más entrada hexadecimal propia. | Flechas de orden, confirmaciones al guardar color y eliminar, validación de hex `#RGB`/`#RRGGBB`, previsualización y ciclo de publicación. Sin DnD. | El DnD histórico no se replica por el contrato global de orden y el modal `xl` se sustituye por un formulario separado; el color se confirma antes de persistir. Falta comparación visual pareada. | Parcial |
| Casa Jovy · Galería | `frontend/src/pages/CasaJovyGalleryPage.tsx`; carga múltiple, contador `n/4`, tabla con miniaturas y confirmaciones. | Parcial: `audit-visual/gallery/`, `audit-final/08-marca-galeria.png`, `08c-marca-galeria-alta.png`. Histórica: `No evaluada`. | Reproducida: pestaña Galería con grid multimedia, multiselección secuencial, contador de visibles y cupo 4, agenda y detección de solapes, lightbox y formulario separado. | Medio, título, orden, estado, ventana de programación y agenda por cupo. | Carga múltiple secuencial con previews, confirmación de carga, reorden y borrado, lightbox y gestión de ciclo de vida. El backend limita a cuatro elementos visibles simultáneos con concurrencia real. | La presentación deja la tabla con miniaturas por grid; el cupo se muestra como contador y agenda. Falta comparación visual pareada. | Parcial |
| Logos | `frontend/src/pages/LogosList.tsx`, `LogoForm.tsx`, `pages/LogoAdjusterModal.tsx`; cuatro columnas, DnD contextual, rutas nueva/editar, canvas con pan/zoom/reset y carga de 20 MB. | Parcial: `audit-visual/logos/`, `audit-final/08b-marca-logos.png`. Histórica: `No evaluada`. | Reproducida: grid 1/2/4 columnas y formulario separado; selector categoría → familias canónicas. | Archivo, familias canónicas, slug, nombre, alt, descripción, orden y `enabled`; recorte como metadatos `zoom`/`offset_x`/`offset_y`. | Crop visual con pan, zoom, guía y reset; confirmaciones de crear, guardar, activar, reordenar y eliminar; carga PNG/JPEG/WebP de hasta 5 MB. | No se replican DnD contextual ni rutas históricas separadas de alta/edición: el orden usa flechas y el formulario es un panel separado. Límite de 5 MB frente a 20 MB histórico. El reorden de logos no tiene E2E propio. Falta comparación visual pareada. | Parcial |
| Anuncios de portada | `frontend/src/pages/PromoBannersList.tsx`, `PromoBannerForm.tsx`; grid, búsqueda/filtro por slot, previews, crop, estados calculados, modal y frecuencia. | Parcial: `audit-visual/announcements/`, `audit-final/09-anuncios.png`, `09b-anuncios-modal-promo.png`, `09c-anuncios-alto.png`. Histórica: `No evaluada`. | Reproducida: `/app/jovy/announcements` con resumen real de banners `promo`, grid de previews con ventana calculada y bloque de mensaje corporativo ES/EN; el CRUD del banner vive en Marketing → Banners. | Slot, título bilingüe, CTA, frecuencia, `auto_open`, ventana UTC y mensaje corporativo. | Búsqueda, filtros por estado/ventana, previews, formulario de banner agrupado con validaciones y confirmaciones de ciclo de vida. | El recorte de banner sigue pendiente porque el backend no persiste `crop_zoom`/offsets. La pantalla Anuncios resume y enlaza; no duplica el formulario. Falta comparación visual pareada. | Parcial |
| Novedades | `frontend/src/pages/EventsList.tsx`, `EventForm.tsx`; tarjetas de cinco columnas, búsqueda/estado/paginación, DnD/restauración y medio por URL o carga. | Parcial: `audit-visual/novelties/`, `audit-final/10-novedades.png`, `10-novedades-video.png`, `10c-novedades-persistido.png`, `10d-novedades-vacia.png`. Histórica: `No evaluada`. | Reproducida: `/app/jovy/novelties` con grid multimedia 1/2/3/5, búsqueda y filtros de estado, tipo y activo, y tarjeta enlazada al evento exacto. | Medio (imagen/GIF/video), `media_type`, prioridad, orden, estado editorial y activo. | Preview de video/GIF, carga y reemplazo/retiro de medio, prioridad/orden, enlace profundo al evento exacto y confirmaciones de guardar, publicar, archivar y retirar. | No hay restauración de eventos ni medio por URL externa; el evento se crea y borra en Eventos Jovy, donde el borrado es lógico desde el fix de backend, pero su restore aún no está expuesto. Falta comparación visual pareada. | Parcial |
| Usuarios | `frontend/src/pages/UsersList.tsx`, `UserForm.tsx`; tabla, filtros, roles, estados, bloqueo y baja definitiva. | Parcial: `audit-final/11-configuracion.png`, `11b-usuarios.png`. Histórica: `No evaluada`. | No replicada en extensión: Users sigue siendo el Admin nativo de Medusa en `Settings → Users`, fuera del CMS. | Usuario, email y metadata nativos; no se replican roles, estados ni bloqueo históricos. | Alta, edición y baja nativas. No hay réplica de filtros, roles, estados, bloqueo ni hard delete históricos. | RBAC Enterprise (`@medusajs/rbac`) no está licenciado ni registrado; cualquier usuario autenticado es admin pleno. No se duplicó identidad ni se simularon roles. | No replicable en extensión |
| Solicitudes · Ventas nacionales | `frontend/src/pages/SalesContactsList.tsx`, `ContactRow.tsx`, `ContactDetailModal.tsx`, `EditContactModal.tsx`, `SalesContactsModals.tsx`; tabla de seis columnas, tabs con Papelera, fecha, búsqueda, páginas 10/20/50, acciones, restauración y exportación. | Parcial: `audit-visual/contacts/`, `audit-final/12-bandeja-nacional.png`. Histórica: `No evaluada`. | Reproducida: `contact-inbox.tsx` con tabla de seis columnas exactas (Fecha, Cliente, Contacto, Ubicación, Mensaje, Acciones) y scroll horizontal. | Todos los campos del modelo, incluidas fecha, ubicación, `handled_at`, `handled_by`, notas y auditoría; contadores por estado y papelera. | Tabs Todos/Pendiente/Atendido/Papelera con counts reales, búsqueda por nombre/apellido/email/teléfono/ciudad/país/CP, fechas, páginas 10/20/50, detalle/edición/auditoría en modales, atender/volver, soft delete + restore, export CSV por bandeja y polling cada 30 s. | Nuevos endpoints `POST /admin/jovy/contacts/:id/restore` y `GET /admin/jovy/contacts/export`; filtros ampliados, counts con `deleted`, PUT de campos del remitente y migración append-only `Migration20261114120000`. Falta comparación visual pareada. | Parcial |
| Solicitudes · Ventas internacionales | Misma familia de componentes de solicitudes; filtro histórico por tipo internacional. | Parcial: `audit-visual/contacts/`, `audit-final/13-bandeja-internacional.png`. Histórica: `No evaluada`. | Reproducida: `contact-inbox.tsx` parametrizado para internacional, con la misma tabla y modales. | Mismos campos y contadores, con `contact_type=international-sales`. | Misma paridad funcional que la bandeja nacional, incluida papelera, export y polling. | El tipo lo fija la ruta y lo revalida el servidor; no hay tabla ni endpoint por bandeja. Falta comparación visual pareada. | Parcial |
| Solicitudes · Atención al cliente | Misma familia de componentes de solicitudes; filtro histórico por tipo de atención. | Parcial: `audit-visual/contacts/`, `audit-final/14-bandeja-servicio.png`. Histórica: `No evaluada`. | Reproducida: `contact-inbox.tsx` parametrizado para atención al cliente. | Mismos campos y contadores, con `contact_type=customer-service`. | Misma paridad funcional que la bandeja nacional. | Misma brecha visual pendiente, aplicada a atención al cliente. | Parcial |
| Solicitudes · Catálogo | Misma familia de componentes de solicitudes; filtro histórico por catálogo. | Parcial: `audit-visual/contacts/`, `audit-final/15-bandeja-catalogo.png`. Histórica: `No evaluada`. | Reproducida: `contact-inbox.tsx` parametrizado para catálogo. | Mismos campos y contadores, con `contact_type=catalogue`. | Misma paridad funcional que la bandeja nacional. | Misma brecha visual pendiente, aplicada a solicitudes de catálogo. | Parcial |

## Evidencia de esta ola

Corrida de regresión registrada el 2026-11-14 sobre el árbol de trabajo:

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Lint | `pnpm lint` | exit 0 |
| Tipos | `pnpm typecheck` | exit 0 |
| Unitarias backend | `pnpm --dir apps/backend test:unit` | 29 suites / 275 pruebas |
| Integración de módulos | `pnpm --dir apps/backend test:integration:modules` | 6 suites / 37 pruebas |
| Integración HTTP | `pnpm --dir apps/backend test:integration:http` | 10 suites / 68 pruebas |
| Build | `pnpm build` | OK (backend + storefront) |
| E2E | `pnpm --dir apps/backend test:e2e` | 27 passed / 0 failed / 4,3 min |

Specs E2E (14): `content`, `hero`, `banners`, `events`, `brand`, `brand-families`,
`contacts`, `contact-inboxes`, `cms-navigation`, `catalogue-admin`, `launches-admin`,
`announcements-admin`, `novelties` y `product-editorial` (27 pruebas).

Capturas locales ignoradas por Git:

- `.test-results/audit-visual/categories/`
- `.test-results/audit-visual/dashboard/`
- `.test-results/audit-visual/products/`
- `.test-results/audit-visual/logos/`
- `.test-results/audit-visual/announcements/`
- `.test-results/audit-visual/novelties/`
- `.test-results/audit-visual/gallery/`
- `.test-results/audit-visual/launches/`
- `.test-results/audit-visual/contacts/`
- `.test-results/audit-final/` (capturas anteriores, incluidas `03-dashboard.png` a
  `20-dashboard-recargado.png`)

Las capturas de `audit-visual/` se generan desde la suite E2E y desde revisiones
manuales del Admin; **no** tienen una captura histórica gemela en el mismo viewport y
no se reinterpretan como comparación visual.

## Criterios de aceptación para una comparación futura

Una pantalla solo puede abandonar `Parcial` o `No evaluada` tras documentar el
resultado para ambos administradores, con los mismos datos no sensibles y la misma
resolución. La evaluación separa estos seis criterios:

1. **Visual:** jerarquía, grilla, columnas, densidad, tipografía, color, estados
   vacíos y modales comparados por captura; una diferencia intencional debe
   quedar escrita, no asumirse equivalente.
2. **Funcional:** cada acción histórica relevante produce el resultado esperado
   o se declara sustitución explícita y verificable.
3. **Navegación:** menú, ruta, retorno, alta, edición y detalle llegan a la
   superficie equivalente sin rutas muertas, redirects ocultos ni ambigüedad.
4. **Formulario:** agrupación de campos, ayuda contextual, controles de media,
   confirmaciones y flujos de crear/editar se verifican por separado.
5. **Validación:** obligatorios, tipo, rango, URL, archivo, estados inválidos y
   mensajes de error se prueban con casos positivos y negativos.
6. **Persistencia:** guardar, recargar, editar, publicar/archivar/restaurar y
   reflejar el dato en la lista o Store se comprueban cuando apliquen.

No hay estado de aceptación en este documento. Una diferencia arquitectónica
puede ser válida para el producto, pero no elimina la necesidad de evaluar los
seis criterios anteriores.

## Método de captura comparable

1. Preparar un conjunto mínimo, reproducible y no sensible de datos para cada
   pantalla: vacío, un registro, varios registros, borrador/publicado y error
   de validación cuando aplique.
2. Iniciar el histórico únicamente en modo de solo lectura si su entorno lo
   permite; si no, mantener la captura histórica como `No evaluada`.
3. Para cada estado, capturar histórico y Medusa a **1440 × 1000** y **375 ×
   812**, con zoom del navegador en 100 %, mismo navegador, sin extensiones y
   fecha/hora anotadas.
4. Registrar URL, viewport, estado de autenticación, fixture usada y acciones
   previas. No incluir PII, tokens, sesiones ni datos de contacto reales.
5. Conservar pares de imágenes bajo un directorio de auditoría distinto del
   runtime de `static/`; enlazar cada par desde esta matriz antes de cambiar un
   estado.

## Corrección priorizada

1. Capturar el administrador histórico en modo de solo lectura y producir pares
   1440 × 1000 / 375 × 812 para las 13 pantallas. Sin ese par ninguna fila pasa
   de `Parcial`.
2. Resolver la decisión comercial de RBAC y validar roles, permisos, bloqueo y
   baja definitiva de Usuarios. `@medusajs/rbac` sigue sin licencia ni registro.
3. Persistir el recorte de banner en backend (`crop_zoom`, offset X/Y, original);
   hoy la UI de Banners no puede reproducir el crop histórico.
4. Recuperar DnD contextual en Logos y Nuevos lanzamientos, o aprobar
   formalmente la sustitución por flechas ya implementada.
5. Exponer el restore de eventos soft-deleted y decidir si vive
   en Eventos Jovy; Novedades no restaura y hoy el borrado es físico. Evaluar
   también medio por URL externa.
6. Reponer las rutas históricas separadas de alta/edición de logos si el negocio
   las exige; hoy el formulario es un panel separado dentro de Marca Jovy.
7. Definir fuente aprobada de analítica para Dashboard antes de reintroducir
   visitas, aperturas y ranking. El tablero ya no es «solo operativo genérico»:
   tiene KPIs 1/3, rangos y refresco, pero declara la analítica sin fuente.
8. Asignación manual producto ↔ familia desde Admin y auditoría de los módulos
   nuevos (`jovy_catalogue`, `jovy_launches`, `jovy_announcements`).
9. Ciclo de vida de medios: borrado, conteo de referencias, transcode y `Range`
   con `file-local`; retención/purga de contactos y rate limit compartido.
10. Completar la cobertura E2E de reordenamiento de logos, restore de ficha
    editorial, restore de eventos cuando exista y Admin nativo (productos,
    categorías, usuarios, pedidos). No aplica un assert de `deleted_at` a
    Galería: su borrado es físico.

## Riesgos y limitaciones

- **RBAC apagado.** `@medusajs/rbac` es Enterprise y no está licenciado ni
  registrado; `authorize`/`hasPermission` son no-op. Cualquier usuario Medusa
  autenticado accede a todo `/admin/jovy/*`, incluida PII de contactos. Es un
  bloqueante de producción, no un pendiente de captura. Ver
  [docs/19-SEGURIDAD-ADMIN.md](19-SEGURIDAD-ADMIN.md).
- **`file-local` público.** Los archivos se sirven sin control de acceso y sin
  soporte de `Range`; no es apto para material sensible ni para video con
  streaming por rangos. El video se entrega completo.
- **Crop de banner pendiente.** El backend no persiste los metadatos de recorte
  del banner; la UI no puede reproducir el encuadre histórico sin una migración.
- **DnD no replicado.** Logos y Nuevos lanzamientos usan flechas/orden numérico
  por el contrato global de orden. La paridad de interacción queda explícitamente
  sustituida, no idéntica.
- **Borrado no uniforme.** Contactos, lanzamientos, familias de catálogo, ficha editorial y eventos usan
  soft delete. Lanzamientos, familias y eventos no exponen restore.
  Páginas editoriales, Hero, banners, galería, logos y tipos de evento se borran
  físicamente, sin restore.
- **Restauración limitada.** Solo la ficha editorial de producto y las
  solicitudes de contacto tienen restore expuesto. Eventos está soft-deleted sin restore expuesto;
  el ciclo de alta, archivo y borrado vive en Eventos Jovy.
- **Contador de exportación impreciso.** El toast de la bandeja calcula filas con
  `text.split(/\r?\n/).length - 1`, es decir, cuenta líneas del CSV, no
  registros. Si un mensaje contiene saltos de línea, el número mostrado supera
  las solicitudes exportadas. El archivo CSV generado sigue siendo correcto.
- **`image_file_id` sin validar en catálogo y lanzamientos.** El esquema acepta
  un id de archivo como texto y no comprueba contra el File Module que exista o
  que sea una imagen. Un id huérfano o de otro contexto se persiste y la URL
  resuelta degrada a `null`. Brand sí valida `media_file_id`.
- **Búsqueda de productos.** En los logs del backend se observa actividad del
  helper `resolve-product-ids` del índice de búsqueda de productos
  (`apps/backend/src/search/`). Es código residual de la capa de búsqueda, no del
  contrato CMS, y no se validó su cobertura; se registra como ruido residual ajeno
  a la paridad, no como una brecha del CMS.
- **Export CSV: `no-store` correcto, auditoría no durable.** La respuesta usa
  `Cache-Control: no-store`, pero la auditoría de la exportación va al logger
  estructurado y no a una tabla durable: un cambio de nivel de log puede perder
  la traza. Cualquier admin autenticado puede descargar hasta 5 000 filas con PII
  por petición mientras RBAC siga apagado.
- **Sin captura histórica.** No hay evidencia visual del Admin histórico
  ejecutado; toda afirmación de paridad visual es una inferencia de fuente
  estática y debe confirmarse con el método de captura comparable.
- **Migraciones append-only.** `Migration20261114120000` amplía el check de
  auditoría de contactos; no se reescriben migraciones ya aplicadas.
- **Rutas planas.** El CMS agrupa todo bajo «JovyCandy CMS» y no reproduce las
  rutas históricas dedicadas. La estructura vigente está en
  [docs/28](28-MATRIZ-PARIDAD-PANTALLAS.md).
