# Paridad visual y funcional — CMS histórico y Admin Medusa

**Corte documental:** 2026-11-17. **Alcance:** comparación de las 13 opciones históricas
contra sus superficies actuales en Medusa. Este documento **no certifica paridad total** ni
declara réplica aceptada: persisten diferencias visibles y funcionales documentadas.

**Relación con `docs/28`:** esa matriz usa el estado `Completa funcional (sin paridad visual)`
para seis pantallas porque su función histórica está cubierta y tienen E2E propio. Ese estado
**no** es una réplica aceptada. Desde el 2026-11-17 existe **referencia real ejecutada** del
Admin histórico (servidor local, login real) y la mayoría de esas pantallas tiene comparación
visual pareada contra ella; el estado de `docs/28` no cambia por sí solo.

## Actualización de cierre (2026-11-17) — CMS/Commerce, modalidad y permisos

Esta sección fija el **estado vigente**; la fase de fidelidad visual y su sidebar de 13
entradas, más abajo, quedan como **registro histórico** de la comparación. No altera los
conteos de regresión de este documento.

- **Menú de 11 entradas.** «JovyCandy CMS» muestra Dashboard, Categorías, Nuevos
  Lanzamientos, Casa Jovy Galería, Logos, Anuncios de portada, Novedades, Ventas
  Nacionales, Ventas Internacionales, Atención al Cliente y **Catálogo — Solicitudes**. Se
  eliminaron las entradas duplicadas Productos y Usuarios: `/app/jovy/products` y
  `/app/jovy/users` ya no existen. Productos se gestiona en el módulo nativo `Products`
  (`/app/products`) y Usuarios en `Settings → Users` (`/app/settings/users`), sin identidad
  paralela. `jovy_product_editorial` sigue siendo extensión del producto comercial (widget
  `product.details`); las funciones aditivas viven en «JovyCandy · Herramientas».
- **Modalidad comercial.** Campo `commercial_mode` en `jovy_product_editorial`; migración
  aditiva `Migration20261117120000`, sin backfill, aplicada en local el 2026-11-17; `null`
  equivale a `CATALOG_ONLY` y nunca se reclasifica automáticamente. `sellableRequirements`
  es informativo, el widget exige confirmación para pasar a `sellable` y
  `/store/jovy/products` expone la modalidad derivada sin precios ni inventario.
- **Seguridad comercial.** Hooks `validate` de `addToCartWorkflow`,
  `updateLineItemInCartWorkflow` y `completeCartWorkflow` en
  `src/workflows/hooks/jovy-commercial-mode.ts`: resuelven `variant_id → product_id` con
  `query.graph`, nunca confían en `metadata` ni en `product_id` del cliente y rechazan con
  `MedusaError(NOT_ALLOWED)` lo que no sea `SELLABLE`. `manage_inventory=false` y ocultar
  el botón «Comprar» no son seguridad.
- **Permisos.** `@medusajs/rbac@2.22.6` es Enterprise, no está licenciado ni registrado;
  `authorize`/`hasPermission` son no-op. Recursos, roles y alternativa sin licencia son
  **diseño no implementado**. Detalle en
  [docs/30](30-MODELO-COMERCIAL-Y-PERMISOS.md).

## Fase de fidelidad visual con admin histórico real (2026-11-17)

Esta fase sustituye la limitación anterior («no existe ninguna captura histórica») por una
**referencia real ejecutada**. La copia aislada de la fase previa queda como evidencia
complementaria, no como referencia principal.

### Referencia utilizada

- **Admin histórico real ejecutado en localhost**: `pnpm --dir backend run dev` +
  `pnpm --dir frontend run dev` dentro de `admin-webjovy`, con MySQL local conectada y
  **login real** con una cuenta temporal facilitada por el usuario. Navegación y captura
  mediante el MCP `browse` de OpenCode.
- Capturas auténticas en
  [`historical-real/`](../apps/backend/.test-results/audit-visual-pair/historical-real/) y
  comparaciones lado a lado en
  [`comparisons-real/`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/),
  con etiquetas «HISTÓRICO REAL · servidor local · login real».
- La cuenta temporal pertenece al usuario; **no se versionan credenciales, sesiones ni datos
  sensibles**. Las capturas se usaron solo con fines documentales.
- **Copia aislada complementaria** (`historical/` + `comparisons/`): montada desde
  `admin-webjovy/frontend` en `%TEMP%\jovy-admin-preview` con un servidor mock DEMO, sin
  backend, autenticación, permisos, persistencia ni reglas de negocio. Sirve para estados
  simulados (vacío/error/modales), no como referencia principal.
- El histórico real se capturó en **tema oscuro**; el Admin de Medusa está en **tema claro**.
  Es una diferencia de **shell/tema**, inevitable sin revestir Medusa y documentada dentro del
  shell; **no** es una diferencia de contenido CMS.

### Lado actual

- Admin de Medusa local (`2.22.6`) con datos DEMO sembrados por API.
- Capturas a **1440 × 1000** y **375 × 812**, navegador Chromium y zoom 100 %.
- El Admin actual conserva su shell, sidebar y componentes `@medusajs/ui`; no se vistió como el
  histórico para forzar una comparación artificial.

### Límites de la evidencia

- La referencia real permite comparar **jerarquía, grilla, densidad, campos, estados y
  estructura** tal como se ven en el histórico auténtico; no sustituye la verificación de
  lógica de negocio ni de reglas backend.
- Las capturas viven en `apps/backend/.test-results/audit-visual-pair/`, ruta **ignorada por
  Git**. Los enlaces funcionan en el árbol local, no en un clon limpio.
- Ocho pantallas tienen comparación pareada real: las seis prioritarias (Categorías, Logos,
  Productos, Nuevos lanzamientos, Anuncios y Novedades), Galería (solo listado 1440) y Dashboard
  (1440, con composite `dashboard-1440`).
- Dashboard ya tiene composite real en `comparisons-real` (`dashboard-1440`). Usuarios y las cuatro
  bandejas de Solicitudes tienen **captura histórica real**, pero **sin composite lado a lado** en
  `comparisons-real` y están `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)` por privacidad: las
  capturas contienen PII real —Usuarios, correos y nombres del administrador antiguo; Solicitudes,
  nombre completo, correo, teléfono, ciudad/código postal y mensajes de clientes en
  `solicitudes-listado-1440.png`— y no se replican en composites. Las cuatro bandejas tampoco pueden
  tener composite compartido: además de propagar PII, la captura es única y sin distinción por tipo;
  se mantiene solo como referencia local y no se redistribuye.
- El único pendiente por cobertura (falta de captura) es Galería (375, formularios y estados), más
  los estados no cubiertos de otras pantallas; Usuarios y las cuatro bandejas no están pendientes
  por cobertura, sino bloqueados por PII.
- Los formularios de creación que no se capturaron, los estados vacío/error y el responsive
  completo siguen pendientes aunque la pantalla base tenga par real.
- Que exista comparación real no convierte la pantalla en réplica aceptada: quedan diferencias
  visibles. **No se declara paridad completa.**

### Evidencia visual

- Histórico real:
  [`historical-real/`](../apps/backend/.test-results/audit-visual-pair/historical-real/) —
  dashboard; categorías (listado/formulario/confirmación); logos (listado/formulario/crop, con
  `original_src`); productos (listado/formulario); lanzamientos (listado/modal); anuncios
  (listado/formulario); novedades (listado/formulario); galería; bandeja de solicitudes
  (`solicitudes-listado-1440.png`: referencia local con PII real, no redistribuir); usuarios
  (PII real, no redistribuir) y mobile 375 de seis pantallas.
- Actual:
  [`current/`](../apps/backend/.test-results/audit-visual-pair/current/) — Medusa a
  1440 × 1000 y 375 × 812 con datos DEMO. Capturas extra:
  [`logos-ajuste-1440.png`](../apps/backend/.test-results/audit-visual-pair/current/logos-ajuste-1440.png),
  [`anuncios-gestor-1440.png`](../apps/backend/.test-results/audit-visual-pair/current/anuncios-gestor-1440.png) y
  [`anuncios-form-nuevo-1440.png`](../apps/backend/.test-results/audit-visual-pair/current/anuncios-form-nuevo-1440.png).
- Composites lado a lado contra el histórico real:
  [`comparisons-real/`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/) —
  etiquetas «HISTÓRICO REAL · servidor local · login real» y «MEDUSA · datos DEMO locales ·
  mismo viewport». Incluye el par del Dashboard:
  [`dashboard-1440.png`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/dashboard-1440.png),
  etiquetas «HISTÓRICO REAL · Dashboard» / «MEDUSA · Dashboard», 1440 × 1000, reproducible con
  `current-capture-dashboard.cjs` y `compose-real-dashboard.py` en esa carpeta. Ni Usuarios ni
  Solicitudes se propagan a composites por PII: las capturas históricas contienen datos personales
  reales (correos y nombres del administrador antiguo en Usuarios; nombre completo, correo, teléfono,
  ciudad/código postal y mensajes de clientes en Solicitudes) y no se replican. En Solicitudes, además,
  la captura es única y sin distinción por tipo, por lo que no hay composite compartido; las capturas
  de ambas se mantienen solo como referencia local y no se redistribuyen.
- Composites contra la copia aislada (evidencia complementaria):
  [`comparisons/`](../apps/backend/.test-results/audit-visual-pair/comparisons/) — etiquetas
  «HISTÓRICO · copia aislada DEMO».
- Copia aislada:
  [`historical/`](../apps/backend/.test-results/audit-visual-pair/historical/).
- Scripts de captura y siembra: `apps/backend/.test-results/audit-visual-pair/*.cjs` y
  `compose.py` (herramientas locales, no versionadas).

### Segunda ola — modales históricos (2026-11-17)

Sobre la misma referencia real se reprodujeron dos interacciones que en la primera ola quedaban
como sustituciones explícitas. Esto documenta coincidencia estructural, **no una réplica aceptada**.

- **Logos — modal de recorte histórico.** El panel inline `CropAdjuster` se sustituyó por un modal
  accesible (`role=dialog`, portal, foco, Escape, trampa de Tab y foco restaurado) abierto desde
  el botón «Ajustar imagen». Borrador local: «Cancelar» descarta, «Aplicar y guardar» confirma en
  `form.crop`, «Volver a img original» resetea sin cerrar, «Deshacer último ajuste» con pila,
  «Ver imagen original», cuadrícula de tercios, zoom 0.5–2 con «Recomendado: 75 %»,
  arrastre/rueda/doble clic y flechas de teclado, además de un panel de ayuda con Vista
  previa/Zoom/Consejos/Botones. El archivo original no se transforma: `jovy_brand_logo.crop` sigue
  persistiendo zoom/offsets y se hidrata al editar. En paralelo se añadió un carril de subida
  propio de 20 MB (`POST /admin/jovy/brand/logos/media`, multer dedicado, firma binaria
  PNG/JPEG/WebP/GIF, coincidencia con el MIME declarado, decodificación real con `sharp` y subida
  del buffer original); el carril general de marketing sigue en 5 MB. **SVG queda excluido
  deliberadamente por riesgo XSS** al servirse inline desde el mismo origen: es un bloqueo de
  seguridad declarado, documentado en la ruta.
- **Nuevos lanzamientos — modal histórico.** El panel separado se sustituyó por un modal en portal
  con `role=dialog`, órbita de foco, Escape/Cancelar sin mutar y foco restaurado; el botón de alta
  se renombró a «Nuevo Slide». Orden de campos: Producto (opcional), Título, Switch Activo, texto
  «Orden: — · arrastra en lista para reordenar», «Subir Imagen», texto «Imagen: máx 20 MB ·
  Video/GIF: máx 100 MB» y pie Cancelar/Crear|Guardar. Descripción y URL HTTPS se conservan en
  «Opciones adicionales», bloque plegable cerrado por defecto. Validaciones intactas. El upload
  real sigue usando el helper de 5 MB PNG/JPEG/WebP: el texto reproduce el histórico, pero los
  mensajes de error dicen la verdad del carril Medusa (diferencia declarada). Lista, color global,
  flechas de orden, activar/desactivar y borrado con confirmación quedan intactos.
- **Evidencia real regenerada (paso 5 del método).** Capturas Medusa en `current/`:
  [`logos-crop-modal-1440.png`](../apps/backend/.test-results/audit-visual-pair/current/logos-crop-modal-1440.png)
  y [`lanzamientos-modal-nuevo-1440.png`](../apps/backend/.test-results/audit-visual-pair/current/lanzamientos-modal-nuevo-1440.png).
  Composites sobrescritos en `comparisons-real/` con los mismos nombres:
  [`logos-crop-modal-1440.png`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/logos-crop-modal-1440.png)
  y [`lanzamientos-modal-nuevo-1440.png`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/lanzamientos-modal-nuevo-1440.png).
  Revisión visual: modales abiertos con coincidencia estructural; quedan tema oscuro/claro, logo
  real frente a placeholder DEMO, zoom distinto, texto de ayuda más extenso en Medusa, ausencia
  del tour «?» del histórico y, en Lanzamientos, opciones adicionales y validaciones visibles.
  Reproducible con `current-capture-modals.cjs` y `compose-real-modals.py` en esa carpeta.

### Tercera ola — navegación del sidebar (2026-11-17, registro histórico)

Estado descrito en esa ola; el menú vigente tiene 11 entradas (ver «Actualización de
cierre» al inicio y `docs/30`). Se reordenó el sidebar del Admin para que el grupo
«JovyCandy CMS» mostrara **exactamente las 13
entradas históricas en orden**: 1 Dashboard (`/app/jovy/dashboard`, ruta nueva que reutiliza el
dashboard), 2 Productos (`/app/jovy/products`, solo cambió el label de nav; el heading sigue
«Productos editoriales» y no se tocó Product Module), 3 Categorías (`/app/jovy/catalogue`),
4 Nuevos Lanzamientos (`/app/jovy/launches`), 5 Casa Jovy Galería (`/app/jovy/brand`, antes «Marca
Jovy»), 6 Logos (`/app/jovy/logos`, ruta separada nueva), 7 Anuncios de portada
(`/app/jovy/announcements`), 8 Novedades (`/app/jovy/novelties`), 9 Usuarios (`/app/jovy/users`,
redirect al gestor nativo `/app/settings/users`, sin sistema de identidad paralelo) y 10-13 las
bandejas (`/app/jovy/contacts-*` sin cambios de path; solo se capitalizaron los labels y los `<h1>`
para que coincidan). Las funciones aditivas se movieron al grupo hermano «JovyCandy · Herramientas»
con rutas `/app/jovy-herramientas/{content,events,marketing,contacts}`; sus componentes compartidos
(`banner-manager`, `contact-inbox`, `ordering`) también se movieron ahí y se importan con rutas
relativas porque el Vite del Admin no resuelve el alias `@jovy/*`.

Evidencia: capturas en
[`current/sidebar-cms-1440.png`](../apps/backend/.test-results/audit-visual-pair/current/sidebar-cms-1440.png)
y [`current/sidebar-herramientas-1440.png`](../apps/backend/.test-results/audit-visual-pair/current/sidebar-herramientas-1440.png),
y el composite
[`comparisons-real/sidebar-cms-1440.png`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/sidebar-cms-1440.png),
con etiquetas «HISTÓRICO REAL · Sidebar CMS» / «MEDUSA · Sidebar CMS». Verificado visualmente: ambos
paneles muestran las 13 entradas en el mismo orden. El E2E `jovy-cms-navigation.spec.ts` verifica los
11 textos en orden y que las cuatro herramientas **no** están en el grupo CMS. Quedan diferencias
visibles: tema oscuro/claro, el histórico pone icono en cada entrada y Medusa solo en la cabecera
del grupo, las entradas de Medusa están anidadas bajo «JovyCandy CMS» y aparecen después de los
enlaces nativos (Search/Orders/Products/Inventory/Customers/Promotions/Price Lists), y el histórico
no usa tildes en «Atencion al Cliente»/«Catalogo». **No se declara réplica aceptada.**

## Matriz de 13 pantallas

**Estados usados:**

- **6 prioritarias:** `Comparación visual realizada contra admin histórico real; quedan
  diferencias visibles (no réplica aceptada)`.
- **Galería:** par real de listado 1440; formularios, estados y 375 siguen
  `PENDIENTE DE COMPARACIÓN`. Es el único pendiente por cobertura, junto con los estados no cubiertos
  de otras pantallas.
- **Dashboard:** par real de 1440 añadido; `Comparación visual realizada contra admin histórico
  real; quedan diferencias visibles (no réplica aceptada)`.
- **Usuarios:** `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)`: existe captura histórica real, pero
  contiene correos y nombres reales del administrador antiguo; no se replica en composites.
- **4 Solicitudes:** `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)`: existe captura histórica real,
  pero `solicitudes-listado-1440.png` contiene PII real (nombre completo, correo, teléfono,
  ciudad/código postal y mensajes de clientes); es única y sin distinción por tipo, por lo que no se
  replica en composites ni se enlaza como evidencia compartible: se mantiene solo como referencia
  local y no se redistribuye.

Las funciones de la columna «Funciones comprobadas» están verificadas por código, pruebas del
repositorio o ambas; la comparación visual real documenta apariencia, no lógica de negocio.

| Pantalla | Referencia utilizada | Evidencia visual | Diferencias detectadas | Diferencias corregidas | Funciones comprobadas | Pruebas ejecutadas | Estado final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Admin histórico real en localhost, capturado con browse; comparación pareada real (composite `dashboard-1440`, 1440 × 1000). | Histórico real: [`dashboard-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/dashboard-1440.png). Actual: [`dashboard-1440`](../apps/backend/.test-results/audit-visual-pair/current/dashboard-1440.png). Composite real: [`dashboard-1440.png`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/dashboard-1440.png), etiquetas «HISTÓRICO REAL · Dashboard» / «MEDUSA · Dashboard». Capturas actuales previas en `audit-visual/dashboard/` y `audit-final/03-dashboard.png`, `20-dashboard-recargado.png`. | Diferencias visibles confirmadas: tema oscuro del shell histórico frente al claro de Medusa; el histórico muestra una fila compacta de 3 KPIs (Productos 111, Eventos 6, Usuarios 6) con icono a la derecha, mientras Medusa agrupa tarjetas por dominio con enlaces «Abrir…»; el histórico muestra VISITAS 0 con ojo rojo, «Sin datos» y «Grenetina Chamoy 2», mientras Medusa declara analítica sin fuente y no muestra ceros ni estimados; «Refrescar» dentro del bloque de rangos en el histórico frente a «Actualizar» en el header de Medusa, con refresco automático 60 s pausado en pestaña oculta. | Ninguna (diferencias declaradas). | Conteos reales del CMS, fecha de generación, KPIs 1/3 responsive, rangos como selector de periodo, refresco manual y automático pausado en pestaña oculta, enlaces operativos. | `jovy-cms-navigation.spec.ts` dentro de la corrida E2E confirmada 29/29 del 2026-11-17; sin prueba visual automatizada | Comparación visual realizada contra admin histórico real; quedan diferencias visibles (no réplica aceptada) |
| Productos | Admin histórico real en localhost, capturado con browse | Histórico real: [`productos-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/productos-listado-1440.png), [`productos-listado-375`](../apps/backend/.test-results/audit-visual-pair/historical-real/productos-listado-375.png), [`productos-form-editar-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/productos-form-editar-1440.png). Composites reales: [`productos-listado-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/productos-listado-1440.png), [`productos-listado-375`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/productos-listado-375.png), [`productos-form-editar-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/productos-form-editar-1440.png). | El histórico real aparece en tema oscuro (shell/tema), con grid de tarjetas y menú de acciones por fila; Medusa en claro, con tarjetas editoriales y enlaces. Arquitectura Medusa nativo + widget editorial frente a formulario histórico propio; sin paginación backend ni menú de fila; densidades y agrupaciones distintas. | Ninguna en esta fase; la separación es deliberada. | Edición exclusiva vía widget `product.details` en el detalle nativo; agregado en `GET /admin/jovy/products/editorial`; ficha editorial, `is_new`, `sort_order`, publicar, archivar, restaurar y eliminar; datos comerciales permanecen en Product Module. | `jovy-product-editorial.spec.ts` dentro de E2E 29/29 (confirmada el 2026-11-17). | Comparación visual realizada contra admin histórico real; quedan diferencias visibles (no réplica aceptada) |
| Categorías | Admin histórico real en localhost, capturado con browse | Histórico real: [`categorias-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/categorias-listado-1440.png), [`categorias-listado-375`](../apps/backend/.test-results/audit-visual-pair/historical-real/categorias-listado-375.png), [`categorias-form-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/categorias-form-1440.png), [`categorias-confirmacion-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/categorias-confirmacion-1440.png). Composites reales: [`categorias-listado-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/categorias-listado-1440.png), [`categorias-listado-375`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/categorias-listado-375.png), [`categorias-form-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/categorias-form-1440.png), [`categorias-confirmacion-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/categorias-confirmacion-1440.png). | Tema oscuro del histórico real (shell/tema). La tarjeta histórica muestra el switch «Próximamente» dentro del panel de clave; la UI actual lo expone también en la tarjeta junto al badge. Título actual «Categorías del catálogo» frente a «Categorias»; shell/sidebar de Medusa; botones «Subir/Bajar» visibles aunque el histórico solo editaba orden en el formulario; campos comerciales adicionales; el placeholder de imagen roto reservaba 128 px. | Imagen solo si carga, sin hueco; tarjeta con gradiente pastel por clave. **Switch «Próximamente» en la tarjeta: diferencia detectada y corregida** | Seis tarjetas, edición, `coming_soon`, `interaction_locked`, imagen, orden, vínculo comercial, seed de claves y ocultación en Store. | `jovy-catalogue-admin.spec.ts` dentro de E2E 29/29; integración HTTP `catalogue-launches.spec.ts` para validación de imagen. | Comparación visual realizada contra admin histórico real; quedan diferencias visibles (no réplica aceptada) |
| Nuevos lanzamientos | Admin histórico real en localhost, capturado con browse | Histórico real: [`lanzamientos-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/lanzamientos-listado-1440.png), [`lanzamientos-listado-375`](../apps/backend/.test-results/audit-visual-pair/historical-real/lanzamientos-listado-375.png), [`lanzamientos-modal-nuevo-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/lanzamientos-modal-nuevo-1440.png). Composites reales: [`lanzamientos-listado-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/lanzamientos-listado-1440.png), [`lanzamientos-listado-375`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/lanzamientos-listado-375.png), [`lanzamientos-modal-nuevo-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/lanzamientos-modal-nuevo-1440.png). | Histórico real en tema oscuro (shell/tema), con modal `xl` para el alta; Medusa reproduce el modal, pero quedan sin DnD (orden con flechas), tema claro, opciones adicionales y validaciones visibles, y un límite real de 5 MB frente al texto histórico de 20/100 MB. | Modal histórico reproducido (portal, `role=dialog`, foco y Escape, «Nuevo Slide», «Opciones adicionales» plegables); antes el alta vivía en un panel separado. | Producto, imagen, orden, `active`, color global, ocho presets, hex válido/inválido, publicar/ocultar y eliminar con confirmación. | `jovy-launches-admin.spec.ts` dentro de E2E 29/29; integración HTTP `catalogue-launches.spec.ts`. | Comparación visual realizada contra admin histórico real; quedan diferencias visibles (no réplica aceptada) |
| Casa Jovy · Galería | Admin histórico real en localhost, capturado con browse | Histórico real: [`galeria-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/galeria-listado-1440.png). Composite real: [`galeria-listado-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/galeria-listado-1440.png). Sin 375 ni estados en `comparisons-real`. | Histórico real en tema oscuro (shell/tema). Se mantiene la diferencia conocida: grid multimedia en vez de tabla con miniaturas; cupo/agenda como contador. Sin par para formularios, estados ni 375. | Ninguna. | Carga múltiple secuencial, previews, cupo de 4 con concurrencia, agenda/solapes, edición, publicar/archivar, reorden, lightbox y borrado físico con confirmación. | `jovy-brand.spec.ts` dentro de E2E 29/29. Sin prueba visual pareada de estados. | Comparación visual realizada contra admin histórico real (solo listado 1440); PENDIENTE DE COMPARACIÓN en 375, formularios y estados |
| Logos | Admin histórico real en localhost, capturado con browse | Histórico real: [`logos-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/logos-listado-1440.png), [`logos-listado-375`](../apps/backend/.test-results/audit-visual-pair/historical-real/logos-listado-375.png), [`logos-form-editar-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/logos-form-editar-1440.png), [`logos-form-editar-crop-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/logos-form-editar-crop-1440.png), [`logos-crop-modal-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/logos-crop-modal-1440.png). Composites reales: [`logos-listado-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/logos-listado-1440.png), [`logos-listado-375`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/logos-listado-375.png), [`logos-form-editar-crop-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/logos-form-editar-crop-1440.png), [`logos-crop-modal-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/logos-crop-modal-1440.png). | Tema oscuro del histórico real (shell/tema). Histórico y Medusa usan un modal de recorte con ayuda lateral, zoom, cuadrícula, undo y «volver a img original»; el histórico expone `original_src` y Medusa persiste el encuadre en `jovy_brand_logo.crop` sin transformar el archivo original. Grid de 4 columnas y filtros coinciden. Quedan DnD contextual por categoría, acciones como botones (no menú), shell con pestaña «Marca Jovy», tema oscuro/claro y el bloqueo deliberado de SVG por XSS; el carril propio de logos acepta 20 MB PNG/JPEG/WebP/GIF. | Filtros históricos, badges y vacío filtrado añadidos en `logo-manager.tsx`; los filtros solo ocultan filas y no alteran el orden global. Modal de recorte accesible reproducido y carril propio de logos de 20 MB con GIF (`POST /admin/jovy/brand/logos/media`); el carril general de marketing sigue en 5 MB. | Crear/editar, familias canónicas, crop pan/zoom/reset, orden global, activar/desactivar, eliminar, búsqueda y filtros. | `jovy-brand.spec.ts`, con prueba nueva de filtros de logos, dentro de E2E 29/29 (confirmada el 2026-11-17). | Comparación visual realizada contra admin histórico real; quedan diferencias visibles (no réplica aceptada) |
| Anuncios de portada | Admin histórico real en localhost, capturado con browse | Histórico real: [`anuncios-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/anuncios-listado-1440.png), [`anuncios-listado-375`](../apps/backend/.test-results/audit-visual-pair/historical-real/anuncios-listado-375.png), [`anuncios-form-editar-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/anuncios-form-editar-1440.png). Composites reales: [`anuncios-listado-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/anuncios-listado-1440.png), [`anuncios-listado-375`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/anuncios-listado-375.png), [`anuncios-form-editar-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/anuncios-form-editar-1440.png). | Histórico real en tema oscuro (shell/tema). El histórico muestra un grid de banners con búsqueda, filtro por slot y badges; Medusa muestra un resumen arriba y el gestor embebido abajo: estructura equivalente, jerarquía distinta. El crop de banner no se persiste; el contenido bilingüe/CTA es aditivo. | `BannerManager` reutilizado con slot promo embebido, sin duplicar formulario ni endpoints; encabezado configurado como `h2` para no crear un segundo `h1`; refresco del resumen tras mutaciones. El gestor embebido conserva cards/preview, pero no reproduce el modal exacto. | Resumen de banners promo, conteos por estado, previews, alta/edición/publicación/archivo/orden/borrado desde el gestor embebido, ventana, frecuencia, `auto_open`, CTA y mensaje corporativo ES/EN. | `jovy-announcements-admin.spec.ts` y `jovy-banners.spec.ts` dentro de E2E 29/29 (confirmada el 2026-11-17). | Comparación visual realizada contra admin histórico real; quedan diferencias visibles (no réplica aceptada) |
| Novedades | Admin histórico real en localhost, capturado con browse | Histórico real: [`novedades-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/novedades-listado-1440.png), [`novedades-listado-375`](../apps/backend/.test-results/audit-visual-pair/historical-real/novedades-listado-375.png), [`novedades-form-editar-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/novedades-form-editar-1440.png). Composites reales: [`novedades-listado-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/novedades-listado-1440.png), [`novedades-listado-375`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/novedades-listado-375.png), [`novedades-form-editar-1440`](../apps/backend/.test-results/audit-visual-pair/comparisons-real/novedades-form-editar-1440.png). | Histórico real en tema oscuro (shell/tema), con tarjetas compactas de 5 columnas; Medusa usa tarjetas más altas con controles multimedia inline. Alta/edición en panel; sin restore de eventos. | Grid corregido a `xl:grid-cols-5` (coincide con el histórico); cards ajustadas para no comprimir controles; prueba E2E que verifica 5 columnas computadas a 1440. | Búsqueda, filtros de estado/tipo/activo, grid 1/2/3/5, imagen/GIF/video, prioridad, orden, publicar/archivar, retirar medio y enlace al evento exacto. | `jovy-novelties.spec.ts`, con aserción nueva de columnas, dentro de E2E 29/29 (confirmada el 2026-11-17). | Comparación visual realizada contra admin histórico real; quedan diferencias visibles (no réplica aceptada) |
| Usuarios | Admin histórico real en localhost, capturado con browse (captura histórica disponible; sin composite lado a lado). | Histórico real: [`usuarios-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/usuarios-listado-1440.png). Sin composite en `comparisons-real`: la captura histórica contiene correos y nombres reales del administrador antiguo, por lo que no se replica en composites (PII, prohibido por la directiva). Capturas previas no pareadas `audit-final/11-configuracion.png`, `11b-usuarios.png`. | Sin comparación pareada, **bloqueada por PII**: la captura histórica real existe, pero contiene correos y nombres reales del administrador antiguo; publicar un lado a lado propagaría PII, prohibido por la directiva. El par queda bloqueado por privacidad, no por falta de captura. Histórico real en tema oscuro (shell/tema). Se mantiene que Users es el Admin nativo de Medusa: sin roles, estados, bloqueo ni baja definitiva históricos, y RBAC sigue sin licencia. | Ninguna. | Alta, edición y baja nativas de Medusa. RBAC Enterprise no licenciado: cualquier usuario autenticado es admin pleno. En la matriz funcional sigue como `No replicable en extensión`. | Sin E2E propio de Users. | PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII) |
| Solicitudes · Ventas nacionales | Admin histórico real en localhost, capturado con browse (captura histórica disponible; sin composite lado a lado). | Histórico real: [`solicitudes-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/solicitudes-listado-1440.png) (referencia local con PII real: nombre completo, correo, teléfono, ciudad/código postal y mensajes de clientes; no redistribuir; captura única de bandeja, sin distinción por tipo). Sin composite en `comparisons-real` ni captura por tipo. Capturas previas no pareadas `audit-visual/contacts/`, `audit-final/12-bandeja-nacional.png`. | Sin comparación pareada, **bloqueada por PII**: la captura histórica contiene PII real del administrador histórico (nombre completo, correo, teléfono, ciudad/código postal y mensajes de clientes) y es única sin distinción por tipo; no puede haber composite compartido ni propagarse. Histórico real en tema oscuro (shell/tema). Se mantiene la brecha visual pendiente y la tabla implementada con seis columnas y scroll horizontal. | Ninguna. | Tabs Todos/Pendiente/Atendido/Papelera con counts, búsqueda por nombre/apellido/email/teléfono/ciudad/país/CP, fechas, páginas 10/20/50, detalle/edición/auditoría, atender/volver, soft delete + restore, export CSV por bandeja y polling 30 s. | `jovy-contact-inboxes.spec.ts`, `jovy-contacts.spec.ts`, unit de inbox y HTTP `contacts-admin.spec.ts`; E2E dentro de 29/29. | PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII) |
| Solicitudes · Ventas internacionales | Admin histórico real en localhost, capturado con browse (captura histórica disponible; sin composite lado a lado). | Misma [`solicitudes-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/solicitudes-listado-1440.png) del histórico real (referencia local con PII real; no redistribuir); sin composite propio. Captura previa `audit-final/13-bandeja-internacional.png`. | Sin comparación pareada, **bloqueada por PII**: misma captura con PII real y única sin distinción por tipo; no puede haber composite compartido ni propagarse. Misma brecha visual que la bandeja nacional. Histórico real en tema oscuro (shell/tema). | Ninguna. | Misma tabla/modales que nacional, con `contact_type=international-sales`; el servidor revalida el enum. | `jovy-contact-inboxes.spec.ts` dentro de E2E 29/29; HTTP `contacts-admin.spec.ts`. | PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII) |
| Solicitudes · Atención al cliente | Admin histórico real en localhost, capturado con browse (captura histórica disponible; sin composite lado a lado). | Misma [`solicitudes-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/solicitudes-listado-1440.png) del histórico real (referencia local con PII real; no redistribuir); sin composite propio. Captura previa `audit-final/14-bandeja-servicio.png`. | Sin comparación pareada, **bloqueada por PII**: misma captura con PII real y única sin distinción por tipo; no puede haber composite compartido ni propagarse. Misma brecha visual. Histórico real en tema oscuro (shell/tema). | Ninguna. | Tabla, filtros, modales, papelera, restore, export y polling con `contact_type=customer-service`. | `jovy-contact-inboxes.spec.ts` dentro de E2E 29/29; HTTP `contacts-admin.spec.ts`. | PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII) |
| Solicitudes · Catálogo | Admin histórico real en localhost, capturado con browse (captura histórica disponible; sin composite lado a lado). | Misma [`solicitudes-listado-1440`](../apps/backend/.test-results/audit-visual-pair/historical-real/solicitudes-listado-1440.png) del histórico real (referencia local con PII real; no redistribuir); sin composite propio. Captura previa `audit-final/15-bandeja-catalogo.png`. | Sin comparación pareada, **bloqueada por PII**: misma captura con PII real y única sin distinción por tipo; no puede haber composite compartido ni propagarse. Misma brecha visual. Histórico real en tema oscuro (shell/tema). | Ninguna. | Tabla, filtros, modales, papelera, restore, export y polling con `contact_type=catalogue`. | `jovy-contact-inboxes.spec.ts` dentro de E2E 29/29; HTTP `contacts-admin.spec.ts`. | PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII) |

**Nota de navegación (tercera ola) — REGISTRO HISTÓRICO:** describe la ola anterior, no el estado
vigente. Entonces el sidebar «JovyCandy CMS» ya no dejaba el tablero como única entrada
«Dashboard»: la fila 1 usaba la ruta dedicada `/app/jovy/dashboard`. Los labels y los ranks del
sidebar reproducían la secuencia histórica de 13 entradas y las cuatro funciones aditivas
(Contenido, Marketing, Eventos y Contactos consolidados) estaban en el grupo hermano «JovyCandy ·
Herramientas» (`/app/jovy-herramientas/*`), no en este grupo. **Estado vigente:** el menú tiene
11 entradas por la separación CMS/Commerce (Productos y Usuarios son solo superficies nativas),
descrita en la sección de cierre «Actualización de cierre (2026-11-17) — CMS/Commerce, modalidad y
permisos» al inicio de este documento. Ver la subsección «Tercera ola — navegación del sidebar».

## Diferencias detectadas contra el histórico real

Consolidadas de las capturas auténticas con login real. Ninguna implica réplica aceptada.

1. **Tema oscuro frente a claro (shell/tema).** El histórico local se capturó en tema oscuro;
   Medusa está en claro. Es una diferencia de shell/tema, inevitable sin revestir el Admin, y se
   documenta **dentro del shell**. No es una diferencia de contenido CMS.
2. **Categorías — switch «Próximamente» en la tarjeta (corregido).** La tarjeta histórica
   lleva el switch dentro del panel de clave; la UI actual solo lo tenía en el formulario y en
   la tarjeta aparece como badge. Se corrigió con onToggleComingSoon en la tarjeta:
   Aplicado y verificado: onToggleComingSoon en catalogue y switch en category-card.tsx.
   El badge permanece; el switch usa confirmacion accesible y la regla historica; la prueba
   E2E cubre cancelacion sin mutar y persistencia tras recargar.
3. **Logos — modal reproducido, residuales visibles.** Histórico y Medusa muestran el modal de
   recorte con ayuda lateral, zoom, cuadrícula, undo y «volver a img original» (`original_src`
   visible en el histórico; `jovy_brand_logo.crop` en Medusa). Quedan tema oscuro/claro, zoom
   distinto, texto de ayuda más extenso en Medusa, ausencia del tour «?» y SVG bloqueado por XSS
   en el carril propio de 20 MB. Grid de 4 columnas y filtros coinciden.
4. **Lanzamientos — modal reproducido, límite real distinto.** El alta usa ya el modal histórico
   (con «Nuevo Slide» y «Opciones adicionales» plegables); quedan tema oscuro/claro, DnD no
   replicado (flechas), opciones adicionales y validaciones visibles, y 5 MB reales de upload
   frente al texto histórico de 20/100 MB.
5. **Anuncios — jerarquía distinta.** El histórico muestra un grid de banners con búsqueda,
   filtro por slot y badges; Medusa muestra un resumen arriba y el gestor embebido abajo.
   Estructura equivalente, jerarquía distinta.
6. **Novedades — densidad de tarjetas.** El histórico usa tarjetas compactas de 5 columnas;
   Medusa tarjetas más altas con controles multimedia inline. El grid ya coincide en 5 columnas.
7. **Productos — grid y menú frente a tarjetas editoriales.** El histórico es oscuro, con grid
   de tarjetas y menú de acciones; Medusa es claro, con tarjetas editoriales y enlaces.
8. **Cobertura desigual del par real.** Ocho pantallas tienen composite en `comparisons-real`:
   las seis prioritarias, Galería (listado 1440) y Dashboard (1440). Usuarios y las cuatro bandejas
   de Solicitudes están `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)`. El único pendiente por
   cobertura es Galería (375, formularios y estados) más los estados no cubiertos de otras pantallas.
   Marcados según evidencia disponible.
9. **Dashboard — distribución de KPIs y analítica sin fuente.** El histórico presenta una fila
   compacta de 3 KPIs (Productos 111, Eventos 6, Usuarios 6) con icono a la derecha y VISITAS 0 con
   ojo rojo, «Sin datos» y «Grenetina Chamoy 2»; Medusa agrupa tarjetas por dominio con enlaces
   «Abrir…» y declara analítica sin fuente, sin mostrar ceros ni estimados. «Refrescar» está dentro
   del bloque de rangos en el histórico frente a «Actualizar» en el header de Medusa.
10. **Usuarios — par bloqueado por PII.** Existe captura histórica real, pero contiene correos y
    nombres reales del administrador antiguo; publicar un lado a lado propagaría PII, prohibido por
    la directiva. El bloqueo es por privacidad, no por falta de captura.
11. **Solicitudes — bandejas bloqueadas por PII.** Existe una captura histórica real, pero
    `solicitudes-listado-1440.png` contiene PII real del administrador histórico: nombre completo,
    correo, teléfono, ciudad/código postal y mensajes de clientes. Además es una sola captura
    genérica sin distinción por tipo, por lo que no puede servir de composite compartido. Publicar
    un lado a lado propagaría datos personales, prohibido por la directiva; las cuatro bandejas
    quedan `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)` por privacidad, no por falta de captura.
    La captura se mantiene solo como referencia local y no se redistribuye.

## Diferencias corregidas

Solo se listan cambios verificables en el árbol de trabajo. Corregir una diferencia **no**
equivale a paridad aceptada.

1. **Logos — filtros y estados.** Se añadieron Buscar, Categoría, Estado, badges
   Total/Activos/Filtrados y vacío filtrado en `logo-manager.tsx`. Los filtros solo ocultan
   filas; el orden global no cambia. Cubierto por la prueba nueva de `jovy-brand.spec.ts`.
2. **Novedades — densidad a 1440.** El grid pasó de 3 a `xl:grid-cols-5` y las cards se
   ajustaron para no comprimir prioridad, orden y carga de medio. La prueba E2E verifica cinco
   columnas computadas, igual que el histórico real.
3. **Anuncios — administración en la misma pantalla.** `BannerManager` se reutiliza con el slot
   `promo` embebido y un callback de refresco. No se duplican formulario ni endpoints. El
   gestor embebido conserva cards/preview, pero no reproduce el modal exacto.
4. **Categorías — placeholder roto.** La imagen solo ocupa espacio si existe y carga; si falla,
   se oculta sin reservar 128 px. La tarjeta usa gradiente pastel por clave.
5. **Jerarquía de encabezados en Anuncios.** El gestor embebido se configuró como `h2`,
   subordinado al `h1` de la pantalla. El atributo duplicado se eliminó y `typecheck` cierra en 0.
6. **Categorías — switch en tarjeta: corregido.** Diferencia detectada y **corregido** en
   E2E propio. Ver punto 2 de «Diferencias detectadas».
7. **Logos — modal de recorte y carril de 20 MB.** El `CropAdjuster` inline se sustituyó por un
   modal accesible y se añadió `POST /admin/jovy/brand/logos/media` con multer dedicado de
   20 MB para PNG/JPEG/WebP/GIF (firma, MIME, `sharp` y buffer original). `jovy_brand_logo.crop`
   conserva zoom/offsets y se hidrata al editar; el archivo original no se transforma. SVG queda
   bloqueado por XSS. Cubierto por E2E de brand y por el composite `logos-crop-modal-1440`.
8. **Nuevos lanzamientos — modal histórico.** El panel separado se sustituyó por un modal en
   portal con foco, Escape/Cancelar sin mutar, «Nuevo Slide» y «Opciones adicionales» plegables;
   validaciones y lista intactas. Cubierto por E2E de launches y por el composite
   `lanzamientos-modal-nuevo-1440`.

## Diferencias aceptadas o justificadas

Estas diferencias se mantienen de forma consciente; no se presentan como equivalentes.

- **Shell/tema (oscuro frente a claro).** El histórico real se capturó en tema oscuro y Medusa
  está en claro. Se acepta como diferencia de shell, inevitable sin revestir el Admin; no
  afecta al contenido CMS.
- **Arquitectura de Productos.** Medusa nativo + widget editorial evita duplicar Product Module,
  pero no reproduce el formulario histórico ni su paginación/menú de fila.
- **Categorías fijas y campos comerciales adicionales.** Las seis claves son un contrato del
  producto; el shell y los botones de orden son diferentes del histórico.
- **Logos: DnD contextual, shell y SVG.** No se persiste orden independiente por categoría; el
  orden se cambia con flechas. El recorte vive ahora en un modal accesible y persistente
  (`jovy_brand_logo.crop`), sin transformar el archivo original. El carril propio acepta 20 MB
  PNG/JPEG/WebP/GIF; SVG queda bloqueado por riesgo XSS al servirse inline desde el mismo origen,
  y el carril general de marketing sigue en 5 MB.
- **Lanzamientos: modal, DnD y límite real.** El alta usa el modal histórico reproducido, pero el
  orden sigue con flechas (sin DnD), el texto anuncia 20 MB de imagen y 100 MB de vídeo/GIF
  mientras el upload real usa el helper de 5 MB PNG/JPEG/WebP.
- **Novedades: cards más altas.** Exponen prioridad, orden y carga inline; el alta/edición vive
  en panel, no en modal.
- **Anuncios: crop no persistido.** El backend no guarda `crop_zoom`, offsets ni original; el
  gestor embebido conserva cards/preview, no el modal exacto.
- **Voz y contenido.** Los textos bilingües/CTA y el mensaje corporativo son aditivos; el
  histórico solo tenía texto fijo.

## Inventario de capturas que debe aportar el usuario

La ejecución del admin histórico real cubre la mayor parte del inventario anterior: **ya no hace
falta** solicitar listados, formularios de edición, confirmaciones ni el mobile 375 de las seis
pantallas prioritarias, ni las pantallas base de Dashboard, Galería, Solicitudes y Usuarios.
Solo restan los **estados aún no cubiertos**: errores, formularios de creación completos y algún
modal, además de los composites de las pantallas sin par.

| Pantalla / estado | Evidencia real ya disponible | Capturas que faltan |
| --- | --- | --- |
| Dashboard | `historical-real/dashboard-1440.png` + composite `comparisons-real/dashboard-1440.png` | Estados vacío/error de analítica; 375. |
| Galería Casa Jovy | `historical-real/galeria-listado-1440.png` + composite | 375; alta múltiple, confirmación de borrado, vacío y error; formularios. |
| Solicitudes (4 bandejas) | Una captura `historical-real/solicitudes-listado-1440.png` (sin distinción por tipo; contiene PII real, solo referencia local, no propagar) | Composite por bandeja a partir de capturas sintéticas/anonimizadas por tipo; la captura histórica real contiene PII y no se propaga. 375; detalle/edición, papelera/restore, vacío y error; paginación 10/20/50 y exportación. |
| Usuarios | `historical-real/usuarios-listado-1440.png` | Composite compartido (bloqueado por PII: no propagar correos reales); 375; formulario nuevo/editar, roles/estados, bloqueo, baja definitiva, vacío y error. |
| Productos | Listado 1440/375, form-editar y composites | Formulario de creación completo; confirmaciones de borrado/archivo; vacío y error. |
| Categorías | Listado 1440/375, form, confirmación y composites | 375 del formulario; confirmaciones restantes; vacío y error; switch de tarjeta verificado en E2E. |
| Nuevos lanzamientos | Listado 1440/375, modal nuevo 1440 y composites (incluido `lanzamientos-modal-nuevo-1440.png` regenerado) | 375 del modal; creación completa; confirmación de eliminar/color; vacío y error. |
| Logos | Listado 1440/375, form-editar, modal de crop 1440 y composites (incluido `logos-crop-modal-1440.png` regenerado) | Formulario de creación completo; 375 del modal de crop; confirmaciones de eliminar/activar; vacío y error. |
| Anuncios de portada | Listado 1440/375, form-editar y composites | Formulario de creación completo; 375 del formulario; confirmación de borrado; vacío y error. |
| Novedades | Listado 1440/375, form-editar y composites | Formulario de creación completo; 375 del formulario; confirmaciones de archivar/retirar; vacío y error. |

Requisitos de cada captura pendiente: mismo navegador, zoom 100 %, sin extensiones, fecha/hora,
URL, viewport, fixture usada y acciones previas. No incluir PII, tokens, sesiones ni
credenciales; la cuenta temporal del histórico real no se documenta ni se versiona.

## Regresión de esta fase

Verificación consolidada del 2026-11-17 sobre el árbol de trabajo:

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Lint | `pnpm lint` | OK; sin incidencias. |
| Tipos | `pnpm typecheck` | 0 en la verificación final del 2026-11-17. |
| Unitarias backend | `pnpm --dir apps/backend test:unit` | 32 suites / 325 pruebas; incluye `media.test.ts` y pruebas nuevas de contactos. |
| Integración de módulos | `pnpm --dir apps/backend test:integration:modules` | 6 suites / 37 pruebas. |
| Integración HTTP | `pnpm --dir apps/backend test:integration:http` | 11 suites / 76 pruebas; incluye validación de `image_file_id` y `X-Export-Count`. |
| Build | `pnpm build` | OK (corrida consolidada del 2026-11-17). |
| E2E | `pnpm --dir apps/backend test:e2e` | 29/29 sin flaky en 4,1 min, corrida final agrupada y secuencial del 2026-11-17; incluye la navegación del sidebar de 11 entradas, el producto editorial desde el detalle nativo, el test de filtros de logos, la aserción de cinco columnas y la prueba del switch de tarjeta con cancelación sin mutar. Nota histórica: en corridas anteriores con el watcher en reinicio apareció un flaky en `jovy-announcements-admin.spec.ts` por un warning `createRoot()`, resuelto al re-ejecutar esa spec aislada (1/1). |
| Switch Próximamente en tarjeta | Corregido y verificado | Incluido en la corrida E2E 29/29 del 2026-11-17; cancelación sin mutar y persistencia tras recarga. |

**Conteos:** la corrida final de regresión del 2026-11-17 cerró con lint 0, typecheck 0,
unitarias 32 suites / 325 pruebas, integración de módulos 6 / 37, integración HTTP 11 / 76,
build OK y E2E 29/29 sin flaky en 4,1 min, agrupado y secuencial. La corrección del switch de Categorías está
incluida en esa corrida E2E 29/29. Tras el reorden del sidebar, el arreglo se verificó en
navegador con el composite `comparisons-real/sidebar-cms-1440.png` y la navegación
(`jovy-cms-navigation.spec.ts`) se re-ejecutó **1/1**. La revisión independiente de esta tercera
ola está **pendiente**; no se declara aprobada.

**Nota honesta sobre la corrida final del 2026-11-17:** el E2E se ejecutó agrupado y
secuencialmente con 29/29 sin flaky, en 4,1 min; la migración `Migration20261117120000` quedó
aplicada en el PostgreSQL local; la validación de modalidad se probó además con 6 escenarios
HTTP del spec `commercial-mode.spec.ts`, incluido el rechazo en `completeCart` sin creación de
orden. Las menciones anteriores a `1 flaky` corresponden a corridas previas con el watcher en
reinicio, no a esta corrida final.

## Criterios de aceptación para una comparación futura

Una pantalla solo puede abandonar `PENDIENTE DE COMPARACIÓN` tras documentar el resultado
contra el **admin histórico real ya ejecutado** (o la instancia original cuando aplique), con
datos no sensibles y la misma resolución. La evaluación separa seis criterios:

1. **Visual:** jerarquía, grilla, columnas, densidad, tipografía, color, estados vacíos y
   modales comparados por captura; una diferencia intencional debe quedar escrita.
2. **Funcional:** cada acción histórica relevante produce el resultado esperado o se declara
   sustitución explícita y verificable.
3. **Navegación:** menú, ruta, retorno, alta, edición y detalle llegan a la superficie
   equivalente sin rutas muertas ni redirects ocultos.
4. **Formulario:** agrupación de campos, ayuda contextual, controles de media, confirmaciones y
   flujos de crear/editar se verifican por separado.
5. **Validación:** obligatorios, tipo, rango, URL, archivo, estados inválidos y mensajes de
   error se prueban con casos positivos y negativos.
6. **Persistencia:** guardar, recargar, editar, publicar/archivar/restaurar y reflejar el dato
   en la lista o Store se comprueban cuando apliquen.

Una diferencia arquitectónica puede ser válida para el producto, pero no elimina la necesidad
de evaluar los seis criterios. La existencia del par real no equivale a fidelidad total.

## Método de captura comparable

1. Preparar un conjunto mínimo, reproducible y no sensible por pantalla: vacío, un registro,
   varios, borrador/publicado y error de validación cuando aplique.
2. El histórico real se ejecutó en localhost con MySQL local y una cuenta temporal del usuario
   mediante `browse`; cualquier captura adicional usa esa misma modalidad y solo lectura.
3. Capturar histórico y Medusa a **1440 × 1000** y **375 × 812**, zoom 100 %, mismo navegador y
   sin extensiones; anotar fecha/hora.
4. Registrar URL, viewport, autenticación, fixture y acciones previas. Sin PII, tokens ni
   sesiones; la cuenta temporal no se documenta.
5. Conservar los pares bajo `audit-visual-pair/{historical-real,comparisons-real}/` y enlazarlos
   desde esta matriz antes de cambiar un estado.

## Residuales funcionales y riesgos

- **RBAC apagado (bloqueante de producción).** `@medusajs/rbac` es Enterprise y no está
  licenciado ni registrado; `authorize`/`hasPermission` son no-op. Cualquier usuario Medusa
  autenticado accede a todo `/admin/jovy/*`, incluida PII de contactos. No es un pendiente de
  captura. Ver [docs/19-SEGURIDAD-ADMIN.md](19-SEGURIDAD-ADMIN.md).
- **Crop de banner no persistido.** El backend no guarda `crop_zoom`, offsets ni original; el
  gestor embebido de Anuncios no puede reproducir el encuadre histórico sin migración.
- **Límite de logos y multimedia.** El carril propio de logos (`POST /admin/jovy/brand/logos/media`)
  acepta 20 MB de PNG/JPEG/WebP/GIF con firma, MIME, decodificación real y buffer original; SVG
  queda bloqueado por riesgo XSS al servirse inline desde el mismo origen (bloqueo de seguridad
  declarado). El carril general de marketing y la carga de imágenes del CMS siguen en 5 MB.
  Novedades usa 5 MB para imagen y 100 MB para GIF/vídeo, con validación de firma real. En
  Lanzamientos el texto reproduce el histórico (20 MB imagen, 100 MB vídeo/GIF), pero el upload
  real usa el helper de 5 MB.
- **DnD contextual no replicado.** Logos y Nuevos lanzamientos ya tienen modal histórico, pero
  siguen usando flechas/orden numérico por el contrato global de orden. Es una sustitución
  explícita, no una interacción idéntica.
- **Restore de eventos no expuesto.** El borrado es lógico desde el fix de backend, pero
  Novedades/Eventos Jovy no ofrecen restauración. Tampoco hay medio por URL externa.
- **Usuarios sin paridad de roles.** Sin RBAC no se replican roles, bloqueo ni baja definitiva
  históricos; la superficie sigue siendo la nativa de Medusa.
- **Par de Usuarios bloqueado por privacidad.** Existe captura histórica real, pero contiene
  correos y nombres reales del administrador antiguo; publicarla en un composite propagaría PII,
  prohibido por la directiva. El par está `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)` por
  privacidad, no por falta de captura.
- **Pares de las cuatro bandejas de Solicitudes bloqueados por privacidad.** La captura histórica
  real `solicitudes-listado-1440.png` contiene PII del administrador histórico: nombre completo,
  correo, teléfono, ciudad/código postal y mensajes de clientes; además es única y sin distinción
  por tipo. Publicarla en un composite propagaría datos personales, prohibido por la directiva, y
  no puede haber composite compartido. Las cuatro bandejas están
  `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)` por privacidad, no por falta de captura; la captura
  se mantiene solo como referencia local y no se redistribuye.
- **Productos sin paginación backend ni menú de fila.** El listado no pagina en servidor y el
  detalle comercial sigue en la UI nativa.
- **Categorías con diferencias de shell y controles.** Título, sidebar y botones Subir/Bajar
  visibles difieren del histórico; el orden también se edita en el formulario. El switch
  «Próximamente» de la tarjeta sigue **corregido**.
- **Galería, Solicitudes y Usuarios sin par visual completo.** Dashboard ya tiene composite real
  (1440). De los restantes, Galería tiene composite solo de listado 1440; las cuatro bandejas de
  Solicitudes y Usuarios están `PENDIENTE DE COMPARACIÓN (BLOQUEADO POR PII)` por privacidad. Falta
  el inventario de estados indicado arriba; el único pendiente por cobertura es Galería (375,
  formularios y estados) más los estados no cubiertos de otras pantallas.
- **`file-local` público y sin `Range`.** Los archivos se sirven sin control de acceso y el
  vídeo se entrega completo; no es apto para material sensible ni streaming por rangos.
- **Borrado no uniforme.** Contactos, lanzamientos, familias de catálogo, ficha editorial y
  eventos usan soft delete; lanzamientos, familias y eventos no exponen restore. Páginas
  editoriales, Hero, banners, galería, logos y tipos de evento se borran físicamente.
- **Retención de contactos y export.** Sin purga/anonimización automática; el export CSV tiene
  límite de 5 000 filas y auditoría por logger, no durable. Cualquier admin autenticado puede
  descargar PII mientras RBAC siga apagado.
- **Búsqueda de productos.** El helper `resolve-product-ids` de `apps/backend/src/search/` sigue
  presente como código residual; no se validó su cobertura y no forma parte del contrato CMS.
- **Migraciones append-only.** `Migration20261114120000` amplía el check de auditoría de
  contactos; no se reescriben migraciones aplicadas.
- **Rutas planas.** El CMS ya no agrupa todo bajo una sola ruta plana: el grupo «JovyCandy CMS»
  muestra las **11 entradas vigentes** (Dashboard, Categorías, Nuevos Lanzamientos, Casa Jovy
  Galería, Logos, Anuncios de portada, Novedades y las cuatro bandejas de contactos, terminando
  en «Catálogo — Solicitudes»). `/app/jovy/products` y `/app/jovy/users` ya no existen:
  Productos y Usuarios son solo superficies nativas. Las funciones aditivas viven en el grupo
  «JovyCandy · Herramientas» (`/app/jovy-herramientas/*`). Estructura vigente y modelo de
  permisos en [docs/28](28-MATRIZ-PARIDAD-PANTALLAS.md) y
  [docs/30](30-MODELO-COMERCIAL-Y-PERMISOS.md).

## Correcciones de backend verificadas en esta fase

- **`image_file_id` validado.** `assertImageFile` comprueba que el archivo exista en el File
  Module y que su firma binaria sea PNG, JPEG o WebP antes de persistir la categoría o el
  lanzamiento. Un id huérfano o de otro tipo responde `INVALID_DATA`. Ya no queda como riesgo de
  datos huérfanos.
- **Contador de export corregido.** La respuesta CSV envía `X-Export-Count` con el número de
  registros, no de líneas físicas. La UI usa ese valor y descarta valores inválidos; un mensaje
  multilínea ya no infla el aviso. La auditoría del export sigue yendo al logger.
- **Carril de subida de logos y middleware dedicado.** `POST /admin/jovy/brand/logos/media`,
  registrado en `apps/backend/src/api/middlewares.ts` con multer propio (`fileSize: 20 * 1024 *
  1024`, `files: 1`): `LIMIT_FILE_SIZE` → 413 y otros `MulterError` → 400. Valida firma binaria
  PNG/JPEG/WebP/GIF, coincidencia con el MIME declarado y decodificación real con `sharp`, y sube
  el buffer original. SVG se rechaza deliberadamente por riesgo XSS; el carril general de
  marketing permanece en 5 MB.
