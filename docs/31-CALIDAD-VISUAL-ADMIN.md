# 31 — Calidad visual del Admin (extensiones JovyCandy)

Estado: `VALIDADO` con revisión pendiente. Fecha: 2026-11-18.

## 1. Contexto

Este documento cierra el trabajo de calidad visual sobre el Admin de Medusa tras
la integración global de dos habilidades de frontend:

- **`modern-web-guidance`** (GoogleChrome), versión declarada
  `2026_11_10-47b4c80e`. Instalación oficial en
  `C:\Users\opdatos\.agents\skills\modern-web-guidance\` y copia canónica en
  `C:\Users\opdatos\Documents\github\gael-ai-devkit\global\skills\modern-web-guidance\`.
  Es la habilidad del catálogo oficial; conserva `SKILL.md` y `guides/` (210
  guías) sin modificaciones.
- **`gael-web-ui-quality`**, habilidad propia del DevKit v2. No la distribuye el
  paquete oficial: vive en
  `C:\Users\opdatos\Documents\github\gael-ai-devkit\global\skills\gael-web-ui-quality\`
  y en la copia global `C:\Users\opdatos\.agents\skills\gael-web-ui-quality\`.

Ambas están registradas en `devkit/inventory.py` con categoría `frontend` y
`enabled: true`. El perfil **Gael-Engineer** (`agents/gael-engineer.md`, copia
de OpenCode en `C:\Users\opdatos\.config\opencode\agents\gael-engineer.md`) se
actualizó con la secuencia obligatoria de **7 pasos** para trabajo frontend:

1. Identificar el problema de interfaz y acotar el patrón o capacidad web.
2. Consultar `modern-web-guidance` con `search` (consulta corta en inglés,
   centrada en una sola capacidad).
3. Recuperar las guías relevantes con `retrieve` a partir de los `id` obtenidos.
4. Evaluar compatibilidad de navegador (Baseline / fallbacks) antes de elegir.
5. Coordinar la implementación con el especialista frontend.
6. Coordinar la comprobación visual (layout, estados, responsive).
7. Verificar validaciones técnicas (typecheck, lint, build y pruebas
   aplicables).

La regla del perfil es consultar `gael-web-ui-quality` antes de elegir patrones
nuevos **sin imponer un diseño universal**: se respeta el sistema visual del
proyecto (tokens `@medusajs/ui`) y el shell nativo de Medusa. Ninguna de las dos
skills se usa para SQL, backend puro, Docker, CI/CD ni operaciones Git.

## 2. Alcance

Solo las **extensiones JovyCandy del Admin**. Quedan expresamente fuera:

- el shell nativo de Medusa (sidebar, topbar, motivos, navegación);
- el Product Module y el widget editorial nativo;
- checkout y storefront;
- permisos y reglas de negocio;
- los proyectos históricos (no se reutiliza su configuración ni sus datos).

Todo el CSS nuevo vive bajo el atributo `[data-jovy-quality]`, aplicado únicamente
en las ocho rutas auditadas, de modo que el resto del Admin no se vea afectado.

Las **8 pantallas auditadas**, a 1440×1000 y 375×812, son:

| # | Pantalla | Ruta |
|---|---|---|
| 1 | Dashboard CMS | `/app/jovy` |
| 2 | Categorías del catálogo | `/app/jovy/catalogue` |
| 3 | Nuevos Lanzamientos | `/app/jovy/launches` |
| 4 | Casa Jovy · Galería | `/app/jovy/brand` |
| 5 | Logos | `/app/jovy/logos` |
| 6 | Anuncios de portada | `/app/jovy/announcements` |
| 7 | Novedades | `/app/jovy/novelties` |
| 8 | Bandeja de solicitudes (Ventas Nacionales) | `/app/jovy/contacts-national-sales` |

## 3. Método y guías consultadas

Siguiendo la secuencia del perfil, se ejecutaron desde un directorio ajeno a
JovyCandy (`%TEMP%`) y, de nuevo, desde la raíz del repo JovyCandy:

```powershell
npx.cmd modern-web-guidance@latest search "responsive data table"
npx.cmd modern-web-guidance@latest retrieve responsive-table,form-factor-adaptation
```

Los `id` reales recuperados fueron **`responsive-table`** y
**`form-factor-adaptation`**. La versión se fijó a la declarada en la skill con
`--skill-version 2026_11_10-47b4c80e`.

Compatibilidad evaluada antes de aplicar cada técnica:

| Capacidad | Evaluación | Decisión |
|---|---|---|
| `text-wrap: balance` | Baseline desde 2024-05 | Se usa en `h1`/`h2` sin fallback |
| `text-wrap: pretty` | No soportado en Firefox | Mejora progresiva: se ignora donde no aplica |
| `scrollbar-color` | Soporte parcial | Mejora progresiva: ignorable, sin rotura |
| `prefers-reduced-motion` | Media query estándar | Se respeta dentro del ámbito JovyCandy |
| `pointer: coarse` | Media query estándar | Objetivos táctiles de 44 px en puntero grueso |
| `@container (max-width: 28rem)` | Consulta de contenedor | Criterio = ancho de tarjeta, no del viewport |

La política de `gael-web-ui-quality` aplicada fue: **tokens semánticos**, radios
y espaciados consistentes, contraste AA y **no cambiar flujos por estética**.
Toda la instrumentación (capturas y métricas DOM) se hizo con Brave headless +
Playwright, login DEMO desde `.admin.local.env`, base `http://127.0.0.1:9001` y
expansión temporal de la cadena de `<main>` antes del `fullPage`, con métricas
capturadas antes de expandir. No se crearon, editaron ni exportaron registros.

## 4. Hallazgos corregidos (con evidencia)

| Hallazgo | antes → después | Evidencia |
|---|---|---|
| **Galería 375 px**: imagen de 411 px desbordaba el viewport | Sin overflow: PNG 411 → 375 px, imágenes máx. 62 px, `overflowingViewport=0` | `04-brand-375.png`; `metrics.json` → `main` 375/411 → scroller ausente en `metrics-after.json` |
| **Bandeja móvil**: scroller sin teclado | `role="region"` + `tabIndex=0` + `aria-label`, foco visible y pista «Desliza…» conservada | `08-contacts-national-sales-375.png`; 319/1100 px intactos, columnas y datos sin cambio |
| **Jerarquía plana** | `h1` 18/500 → **20/600**; `h2` → **16/600** con `text-wrap: balance` | `metrics.json` → `metrics-after.json`, campo `headings` en las 16 pantallas |
| **Grillas con hijos únicos** | `auto-fit minmax(min(100%,16rem),1fr)`: sin columnas vacías | `dashboard-kpis.tsx:103`, `launches/page.tsx:406`; `01-dashboard-1440.png` |
| **Regresión Lanzamientos 1440** | imagen 1146×859 (PNG 1,4 MB) → **318×238,5** (PNG 251 KB) | `capture-quality-launches.cjs`; `max-w-[20rem]` en `launches/page.tsx:414`; `metrics-after.json → 03-launches-1440.images` |
| **Radios y espaciados dispares** | tokens y clases scoped | `jovy-quality.css`: `--jovy-radius-sm/md/lg` (4/8/12 px), `--jovy-space-1..4` (4/8/12/16 px), `--jovy-elevation-1`; clases `.jovy-card`, `.jovy-media`, `.jovy-actions`, `.jovy-icon-button`, `.jovy-scroll` |
| **Movimiento** | `prefers-reduced-motion: reduce` anula animaciones/transiciones solo bajo `[data-jovy-quality]` | `jovy-quality.css:128-136` |

Detalles de las dos correcciones críticas:

- **Casa Jovy Galería a 375 px.** Se aplicó `max-inline-size: 100%` y
  `min-inline-size: 0` al contenedor y a la multimedia, `flex-wrap` en el grupo
  de acciones y una consulta de contenedor que envía «Eliminar» a una fila propia
  de ancho completo. Resultado: el PNG pasó de 411 a 375 px, sin texto cortado y
  sin desbordamiento horizontal nuevo. Las demás acciones siguen en dos filas.
- **Bandeja de solicitudes.** El envoltorio `div.overflow-x-auto` pasó de
  `tabIndex=-1` a `tabIndex=0`, con `role="region"` y `aria-label`; se añadió
  `:focus-visible` con anillo de 2 px. La tabla sigue midiendo 1100 px de ancho
  y mostrando 319 px en móvil: **no se alteraron columnas ni datos**. Los dos
  iconos de acción (22,16×28 y 23,98×28 px) y el anillo de foco no son
  verificables en una captura estática; quedan como puntos pendientes de revisión.

La recaptura parcial de Lanzamientos sobrescribió solo `after/03-launches-*.png`
y fusionó esas dos claves en `metrics-after.json`; `before/` quedó intacto y los
composites se regeneraron solo para esos pares.

## 5. Conservado deliberadamente

No se tocó, por pertenecer al sistema visual del proyecto o al contrato
funcional:

- la paleta de **@medusajs/ui**; contraste medido de `#52525b` **7,7:1** y
  `#71717a` **4,8:1**, ambos AA;
- los **degradados pastel por categoría** y los **8 presets de color** de
  Lanzamientos;
- la estructura de tarjetas, los formularios, las acciones, los textos, las
  rutas `/app/jovy/*` y los **testids E2E** (`data-testid`);
- los **badges pills** y los **switches nativos** de `@medusajs/ui`: se dejan
  como están aunque su radio (9999 px) o su altura (32×18 px) no coincidan con
  los tokens nuevos, porque forman parte del sistema visual de Medusa;
- el shell nativo, el Product Module y los proyectos históricos (fuera de alcance).

## 6. Evidencia

Toda la evidencia está bajo
`apps/backend/.test-results/audit-visual-quality/` (rutas relativas desde
`docs/`, prefijo `../apps/backend/.test-results/audit-visual-quality/`):

| Artefacto | Contenido |
|---|---|
| [`before/`](../apps/backend/.test-results/audit-visual-quality/before/) | 16 PNG del estado anterior |
| [`after/`](../apps/backend/.test-results/audit-visual-quality/after/) | 16 PNG del estado posterior |
| [`comparisons/`](../apps/backend/.test-results/audit-visual-quality/comparisons/) | **16 pares** antes/después + 1 recorte auxiliar (`detalle-dashboard-kpis-1440.png`) |
| [`informe-auditoria-visual.md`](../apps/backend/.test-results/audit-visual-quality/informe-auditoria-visual.md) | Hallazgos del estado anterior, severidades y prioridades |
| [`resumen-after.md`](../apps/backend/.test-results/audit-visual-quality/resumen-after.md) | Comparación numérica y verificación de los composites |
| [`metrics.json`](../apps/backend/.test-results/audit-visual-quality/metrics.json) | Métricas DOM del ANTES |
| [`metrics-after.json`](../apps/backend/.test-results/audit-visual-quality/metrics-after.json) | Métricas DOM del DESPUÉS (añade `images` y `buttons`) |
| [`capture-quality.cjs`](../apps/backend/.test-results/audit-visual-quality/capture-quality.cjs) | Script de captura original |
| [`capture-quality-after.cjs`](../apps/backend/.test-results/audit-visual-quality/capture-quality-after.cjs) | Script de captura posterior |
| [`compose-quality.py`](../apps/backend/.test-results/audit-visual-quality/compose-quality.py) | Compositor de pares (acepta nombres de clave como argumento) |

**Aviso:** `.test-results/` está ignorado por Git. Los enlaces funcionan en local,
pero los artefactos no se versionan; para reproducirlos hay que volver a capturar.

## 7. Regresión final

| Comprobación | Resultado |
|---|---|
| lint | 0 |
| typecheck | 0 |
| unit | 32 suites / 328 pruebas |
| integración de módulos | 6 suites / 37 pruebas |
| integración HTTP | 11 suites / 76 pruebas |
| build | OK |
| E2E (agrupada y secuencial) | **29/29 en 6,8 min** (corrida de esa ola) |

Revisión visual: 8 pantallas × 2 viewports, antes y después, con 16 composites
pareados. No hay desbordamiento horizontal nuevo en ninguna de las 16
capturas; el único cambio de altura es más scroll vertical en
`04-brand-375` (2898 → 3186 px) y `03-launches-375` (1256 → 1292 px) por
botones más grandes.

## 8. Ajuste específico de Categorías (2026-11-18)

Ajuste puntual sobre las seis tarjetas de `/app/jovy/catalogue`, sin cambios de
flujo ni de sistema visual.

- **Hallazgos reales.** Los 6 switches «Próximamente» compartían el mismo nombre
  accesible y medían 32×18 px; la nota «Sin descripción.» se repetía sin jerarquía
  visual. No había overflow horizontal, el contraste cumplía AA y el foco era
  lógico: esos tres puntos no se cambiaron.
- **Guías consultadas esta sesión.** `search "accessible switch control"` →
  `retrieve "switch"` y `retrieve "form-factor-adaptation"`. Compatibilidad
  evaluada: el `<input switch>` nativo tiene soporte limitado (Safari 17.4+, sin
  Chrome/Edge/Firefox) y el proyecto usa `Switch` de `@medusajs/ui`; no se añadió
  polyfill ni se cambió el componente.
- **Cambios.** `aria-describedby={titleId}` en el switch conservando el
  `aria-label="Próximamente"` exacto (los E2E dependen de él); envoltorio
  `.jovy-switch-hit` con área táctil de 44×36 px (`pointer: coarse` la amplía) y
  `gap-4` para no solapar el badge; `:focus-visible` scoped con `--jovy-focus`;
  estado vacío «Sin descripción.» en `text-ui-fg-muted` e itálica, conservando el
  texto y `min-h-10`. Se conservaron las seis tarjetas, los gradientes, los
  badges, el orden, las acciones y los flujos.
- **Evidencia.** Bajo
  [`audit-categories/`](../apps/backend/.test-results/audit-categories/):
  `before/`, `after/`, `comparisons/categorias-1440.png` y
  `categorias-375.png`, `metrics-before.json`, `metrics-after.json`, `capture.cjs`,
  `capture-after.cjs` y `compose.py`. Métricas: 6 tarjetas y mismos anchos
  (388/351 px), overflow 0 y diff de píxeles del 0.188% (1440) y 0.328% (375).
- **Verificación.** E2E de Categorías 4/4; lint 0, typecheck 0 y build OK; suite
  E2E completa 29/29 en 6,8 min (corrida de esa ola), agrupada y secuencial.

## 9. Reducción de ruido y UX de Categorías (2026-11-18)

Segundo ajuste puntual sobre las seis tarjetas de `/app/jovy/catalogue`.
Continúa la sección 8 sin cambiar flujos ni sistema visual.

- **Decisión.** La clave no se elimina: es **identidad contractual de las seis
  tarjetas fijas**. Pasa a una línea compacta atenuada `clave · Disponible/Bloqueado`,
  agrupada con `role="group"` y un `aria-label` descriptivo. Los datos secundarios
  (Categoría comercial, Familias/productos), que suelen estar vacíos, se mueven a un
  `<details>` cerrado por defecto con resumen «Detalles comerciales»; el conteo solo
  se muestra cuando hay datos reales.
- **Contenido que sigue visible.** Badge `#n`, estado, título, descripción, switch
  «Próximamente» con `aria-describedby` y botones Editar/Subir/Bajar. El bloque de
  estadísticas superiores ya había sido retirado en un ajuste anterior. La E2E que
  aún lo esperaba se actualizó para verificar el `h1` y la tarjeta chamoy en el
  diseño vigente, conservando la fuerza de la comprobación; donde hacía falta ver
  el vínculo comercial se añadió la apertura del `<details>`.
- **Guías y compatibilidad.** Se aplicaron `content-first-noise-reduction` y
  `search-hidden-content` de `modern-web-guidance`. `<details>` es Baseline desde
  2020-01-15 y es nativo, sin polyfill. No se usaron Popover ni
  `hidden="until-found"` por soporte parcial o innecesario. El contenido plegado
  sigue accesible y buscable con Ctrl+F.
- **Evidencia.** Bajo
  [`audit-categories-noise/`](../apps/backend/.test-results/audit-categories-noise/):
  `captures/`, `comparisons/`, `capture.cjs`, `compose.py`, `metrics.json` y
  `report.txt`. Ahorro real por tarjeta: −68.6 px (−16.6 %) a 1440 y −54.6 px
  (−13.7 %) a 375; a 375 la página baja 2749 → 2550 px (−7.2 %). En 1440 el
  promedio global está enmascarado por una imagen nueva en la tarjeta #1, no por
  la compactación.
- **Verificación.** E2E de Categorías 4/4; suite E2E completa 29/29 en 6,8 min
  (corrida de esa ola), agrupada y secuencial; lint, typecheck y build en 0. Contraste oscuro preservado
  (2/102 fallos, ambos controles deshabilitados exentos).

## 10. Miniatura de imagen en Categorías (2026-11-18)

Tercer ajuste puntual sobre las seis tarjetas de `/app/jovy/catalogue`. Reduce la
altura de la miniatura sin cambiar flujos ni sistema visual.

- **Medición real con Browse MCP.** En la pestaña del operador (1920 px,
  3 columnas de 515 px), las tarjetas con imagen medían 472 px frente a 344 px de
  las que no tenían imagen; el `<img>` era `h-32 w-full object-cover` (128 px
  fijos, natural 2614×2126).
- **Guía consultada.** `card` de `modern-web-guidance`: «set `aspect-ratio` and
  `object-fit: cover` on the `<img>` itself». Se aplicó `aspect-ratio: 4/1` +
  `max-block-size: 3rem` (48 px) + `object-fit: cover` en la clase scoped
  `.jovy-card-media`, sin animaciones (el router activó `motion-design`, pero no
  aplica a este cambio).
- **Resultado medido en Browse.** Imagen renderizada de 513×48, tarjeta de
  472 → 392 px (−80) y `main.scrollHeight` de 974 → 894 a 1920 px. En Playwright
  a 1440/375: tarjeta 472,4 → 392,4 px, sin distorsión ni desbordamiento
  horizontal; `main` 974 → 947 a 1440 (desbordamiento 27 → 0) y 2625 → 2465
  a 375.
- **Evidencia.** Bajo
  [`audit-categories-image/`](../apps/backend/.test-results/audit-categories-image/):
  `captures/`, `comparisons/image-1440.png` y `image-375.png`, `capture.cjs`,
  `compose.py`, `metrics.json` y `report.txt`, además de una captura puntual de
  Browse de la tarjeta.
- **Conservado.** Contenido, switches, badges, `<details>`, botones y flujos
  intactos. Las dos imágenes DEMO que aparecen en la comparación se deben a un
  cambio de datos, no de estilo.
- **Verificación.** E2E de Categorías 4/4; suite completa 29/29 en 6,8 min
  (corrida de esa ola), agrupada y secuencial; typecheck, lint y build en 0.

## 11. Rediseño de Casa Jovy Galería (2026-11-18)

Rediseño de `/app/jovy/brand` centrado en quitar ruido y en repartir mejor el
espacio entre carga y listado. No cambia flujos más allá de eliminar la creación
desde la UI.

- **Alcance.** Se eliminó por completo «Logos» de esta pantalla: el grupo
  «Galería Casa Jovy | Logos», el título «Marca Jovy» y la mención a logos en el
  párrafo. Los logos siguen en su entrada propia del sidebar `/app/jovy/logos`,
  que no se tocó. También se eliminó el botón «Nuevo elemento» y la ruta de
  creación desde la UI; la edición de los elementos existentes sigue disponible
  por «Editar …».
- **Layout.** «Cargar imágenes» y «Elementos de galería» se reparten en dos
  columnas a partir de `xl` (`minmax(20rem,0.8fr)` + `minmax(0,1.2fr)`) y se
  apilan en móvil. Las filas usan consultas de contenedor (`container: gallery /
  inline-size`, umbral `38rem`) para pasar de 3 columnas a 1 según el ancho real
  de la columna y no el del viewport.
- **Ruido eliminado.** Se retiró el bloque «Agenda de cupo»: límite, visibles
  ahora, pico programado, borradores, archivados, ocupan cupo y ventanas que
  solapan. La información esencial de cupo queda en el badge «Visibles ahora: N
  de 4» del panel de carga (`gallery-quota-now`).
- **Acciones.** Por elemento quedan 4 acciones primarias visibles (Subir/Bajar
  compactos, Ampliar, Editar, Publicar/Despublicar) y un `DropdownMenu` «Más
  acciones para …» (Radix de `@medusajs/ui`, sin polyfills) con Archivar,
  Activar/Desactivar y Eliminar. Se pasó de 8 botones a 5 controles por fila.
- **Guías.** `menu`: se descartó el menú nativo con `focusgroup`, anchor
  positioning y `commandfor` por soporte limitado y necesidad de polyfills; se
  usó el componente oficial ya instalado. `content-first-noise-reduction`:
  eliminar contenido secundario que no aporta a la tarea. `responsive-design`:
  consultas de contenedor. El bloque `details` y la agenda no se reintroducen.
- **Evidencia.** Bajo
  [`audit-gallery-ux/`](../apps/backend/.test-results/audit-gallery-ux/):
  `after/`, `comparisons/`, `metrics.json`, `report.txt` y `capture-gallery.cjs`.
  Medidas: a 1440 el panel de carga va en x=232 con 472 px y el listado en x=720
  con 708 px (misma fila, Δy=0); antes el listado empezaba en y≈639. A 375 los
  paneles quedan apilados (Δx=0, Δy≈593) sin overflow. Filas a 1440:
  `96px + 1fr + auto`; a 375: 1 columna.
- **Verificación.** E2E de Brand 5/5; suite completa 29/29 en 6,8 min (corrida de
  esa ola), agrupada y secuencial; lint, typecheck y build en 0. El test largo de orden y eliminación
  se estabilizó con `test.setTimeout(90_000)` y un helper que espera
  `toBeEnabled` del trigger y `toBeVisible` del menú; no se añadieron sleeps ni
  retries.
- **Regresión corregida durante la validación.** El bloque `<details>` de datos
  comerciales de Categorías había desaparecido en una edición previa; se
  restauró y la E2E de Categorías volvió a 4/4. Se documenta como incidencia de
  validación, no como parte de este rediseño.

## 12. Títulos duplicados eliminados (2026-11-18)

Eliminación de encabezados redundantes en dos pantallas, sin cambios de flujo ni
de sistema visual.

- **Logos.** La ruta `/app/jovy/logos` renderizaba el `h1` «Logos» de la página y
  el gestor repetía un `h2` «Logos». Se retiró el `h2` del gestor y se
  conservaron la descripción, «Nuevo logo», «Buscar» y los filtros. Verificado en
  navegador: exactamente un `h1` «Logos» y cero `h2` «Logos» a 1440 y 375.
- **Anuncios de portada.** El `BannerManager` embebido repetía «Gestión del modal
  (slot promo)» bajo «A. Modal de portada». El título del gestor pasó a ser
  opcional y se invoca con `heading=""`, de modo que no se renderiza, conservando
  su descripción, botones y listado. Jerarquía verificada: `h1` «Anuncios de
  portada», `h2` «A. Modal de portada», `h2` «B. Mensaje corporativo», sin el
  título intermedio; el gestor mantiene su `h2` interno «Banners» del listado.
- **Guía aplicada.** `content-first-noise-reduction` de `modern-web-guidance`:
  eliminar contenido redundante que no aporta a la tarea. Sin dependencias ni
  polyfills.
- **Evidencia.** Bajo
  [`audit-headings/`](../apps/backend/.test-results/audit-headings/): capturas
  1440/375 de ambas pantallas y `report.txt`/`report.json`; **28/28 comprobaciones
  PASS**, sin overflow ni errores de consola.
- **E2E ajustada.** La aserción de «Gestión del modal (slot promo)» pasa a
  verificar `data-testid="banner-manager"`; el resto queda intacto.
- **Verificación.** E2E enfocada de announcements+brand+banners 8/8; suite
  completa 29/29 en 6,8 min (corrida de esa ola); lint, typecheck y build en 0.

## 13. Simplificación de Anuncios de portada (2026-11-19)

Reducción de ruido sobre `/app/jovy/announcements`: la página pasa a dos bloques
claros y deja de duplicar lo que ya muestra el gestor. Sin cambios de flujo, de
contrato ni de sistema visual.

- **Problema medido.** El documento medía **2460 px** a 1440 y **4038 px** a 375.
  Había **6 stats + 4 badges duplicados**, un bloque «Vista previa» redundante con
  las propias tarjetas del gestor y un bloque «Valores persistidos» que repetía el
  contenido de los textareas. Convivían **dos botones «Actualizar»** y un enlace
  «Abrir Banners» que contradecía la existencia del gestor embebido; «Limpiar
  filtros» aparecía siempre por el filtro de slot fijo. Además, **7 párrafos
  largos** con jerga interna y **4 niveles de tarjetas** anidados.
- **Decisión.** La página queda en dos bloques: **«Modal de portada»** y **«Mensaje
  corporativo»**, sin prefijos «A./B.» y sin badge «Marketing Jovy», con **una
  frase por bloque**. Se eliminaron los stats, la vista previa, los valores
  persistidos, el CTA duplicado, el botón «Actualizar» de página, la descripción
  técnica del gestor, el filtro de slot y los badges de stats en modo embebido. El
  gestor conserva buscador, filtro de estado, tarjetas, alta/edición,
  publicar/archivar y acciones; el formulario corporativo y su guardado quedan
  intactos.
- **Modo embebido.** Nuevas props `showDescription`, `showSlotFilter`, `showStats`
  y `listHeadingLevel`; en esa ola Marketing conservaba el comportamiento por
  defecto. El CRUD unificado (§15) retira después el gestor de Marketing, que solo
  enlaza «Abrir Anuncios de portada». El
  cálculo de `filtersActive` ignora el slot fijo, por lo que «Limpiar filtros» no
  aparece al abrir, mientras que el filtrado real por promo sigue activo. El
  heading interno «Banners» pasa a `h3` en embebido.
- **Resultado medido.** Documento **2460 → 1551 px (−37,0 %)** a 1440 y
  **4038 → 2031 px (−49,7 %)** a 375. Primer control editable **1001 → 342 px
  (−65,8 %)** y **1807 → 335 px (−81,5 %)**. Controles antes del primer banner
  **5 → 2**. Jerarquía final: `h1` «Anuncios de portada», `h2` «Modal de portada»,
  `h3` «Banners», `h2` «Mensaje corporativo». Sin overflow horizontal ni errores
  de consola a 1440 ni a 375.
- **Guía.** `content-first-noise-reduction` de `modern-web-guidance`; sin
  dependencias nuevas.
- **Evidencia.** Bajo
  [`audit-announcements/`](../.test-results/audit-announcements/) (raíz del repo):
  `before/`, `after/`, `comparisons/`, `metrics*.json`, `report*.txt` y los scripts
  de captura y composición.
- **E2E ajustada.** La prueba de Anuncios verifica ahora el gestor por su
  contenedor, las tarjetas y las imágenes, la ausencia de filtro de slot, de
  «Limpiar filtros» y del enlace duplicado, y los valores de los textareas en lugar
  de los testids de «Valores persistidos». `jovy-banners.spec.ts` no cambió. E2E
  enfocada **3/3**; suite completa **29/29 en 6,8 min (corrida de esa ola)**;
  lint, typecheck y build en 0.
- **Residual declarado.** El formulario de banner todavía permite cambiar el slot a
  `hint` en modo embebido; si se guarda, la tarjeta puede salir del listado promo
  filtrado. Se deja como está para no alterar reglas de negocio.

## 14. Tarjetas de banner simplificadas (2026-11-19)

Compactación de las tarjetas del gestor de banners de `/app/jovy/announcements`,
reutilizando el patrón de acciones secundarias ya aplicado en Galería. Sin cambios
de flujo, de contrato ni de sistema visual.

- **Antes.** Cada tarjeta mostraba **4 badges** (estado, habilitado, ventana y
  auto-apertura), **5 líneas de metadatos** (prioridad, orden, frecuencia, ventana
  y CTA) y **6 botones**: Editar, Publicar/Despublicar, Archivar, Subir, Bajar y
  Eliminar.
- **Ahora.** Quedan **2 badges editoriales visibles** (estado y ventana) más el
  badge de slot sobre la imagen; una línea compacta «Prioridad n (etiqueta) ·
  Orden n»; y frecuencia, ventana, CTA, auto-apertura y estado habilitado dentro de
  un `<details className="jovy-card-details">` cerrado por defecto. Visibles
  quedan solo **Editar** y **Publicar/Despublicar**; Archivar, Subir, Bajar y
  Eliminar pasan a un `DropdownMenu` «Más acciones para …»
  (`banner-actions-<id>`). Se conservan los nombres accesibles y las condiciones de
  deshabilitado de cada acción.
- **Resultado medido.** Documento **1551 → 1473 px (−5,0 %)** a 1440 y
  **2031 → 1876 px (−7,6 %)** a 375. El gestor pasa de **845 → 768 px** y de
  **1311 → 1155 px**. La tarjeta mide **≈552 → 475 px** a 1440. Por tarjeta quedan
  **tres controles visibles** en lugar de seis.
- **Guía.** `content-first-noise-reduction` de `modern-web-guidance`, reutilizando
  el patrón de acciones secundarias ya aplicado en Galería con el `DropdownMenu`
  oficial de `@medusajs/ui`, sin dependencias nuevas.
- **Evidencia.** Bajo
  [`audit-announcements/after-cards/`](../.test-results/audit-announcements/after-cards/),
  con `comparisons/announcements-cards-1440.png` y
  `comparisons/announcements-cards-375.png`, `metrics-cards.json`,
  `report-cards.txt`, `capture-cards.cjs` y las páginas HTML de comparación.
- **Verificación.** E2E enfocada de banners+announcements **3/3**; suite completa
  **29/29 en 6,8 min (corrida de esa ola)**; lint, typecheck y build en **0**. El
  build de producción se regeneró para que `medusa start` en el puerto 9000 sirva la
  versión nueva; el usuario debe **recargar** el Admin para verla.
- **Nota.** El badge de slot «Modal de portada» sobre la imagen se conserva porque
  identifica el tipo de banner.

## 15. CRUD unificado de Anuncios de portada (2026-11-19)

Los dos tipos de anuncio de portada dejan de estar separados entre Marketing y
Anuncios: pasan a administrarse desde un único gestor, sin duplicar formularios ni
listados.

- **Un solo lugar.** `/app/jovy/announcements` gestiona ambos tipos con un selector
  **«¿Dónde aparece?»**: «Bajo el logo» (slot `hint`, fijo) y «Modal de entrada»
  (slot `promo`). Marketing Jovy deja de tener la pestaña y el gestor Banners y solo
  muestra el enlace «Abrir Anuncios de portada»; Hero sigue en Marketing
  (`/app/jovy-herramientas/marketing`).
- **Formulario intuitivo.** El tipo es el primer campo del formulario. Frecuencia y
  auto-apertura solo se muestran para el modal. La vigencia usa los presets
  «Permanente / 1 semana / 2 semanas / Personalizado». Se añade «Duración en
  pantalla» por banner (`rotation_seconds`, 8 s por defecto, rango 3–60) y la
  frecuencia nueva **«Una vez por navegador»** (`once`), además de cada recarga,
  sesión y día.
- **Backend.** Migración aditiva `Migration20261119133346` aplicada en local:
  `rotation_seconds integer not null default 8` con check 3–60 y check de
  `frequency` ampliado con `once`. La Store API expone `rotation_seconds`. Suite
  unitaria en **32 suites / 328 pruebas**.
- **Comportamiento de rotación acordado.** La rotación aplica a ambos slots; en el
  modal se abre uno solo y dentro rotan los anuncios; con un único anuncio no rota;
  la duración es individual por banner. La pausa al pasar el ratón o enfocar y el
  respeto a `prefers-reduced-motion` quedan para el storefront, que **todavía no
  consume los banners**: no se declara la rotación como activa en la web.
- **Detección de tipo.** Cada tarjeta muestra el badge «Bajo el logo» o «Modal de
  entrada», y el listado se puede filtrar por tipo.
- **Correcciones de validación.** Se eliminó el `Container` vacío del gestor
  embebido (de ~88 px a una fila de 28 px sin caja) y se corrigió el doble punto de
  «Vigencia:».
- **Evidencia.** Bajo
  [`audit-announcements-unified/`](../.test-results/audit-announcements-unified/)
  (raíz del repo): capturas finales a 1440×1000 y 375×812, `metrics-final.json` y
  `report-final.txt`.
- **Verificación.** E2E enfocada de banners+announcements+hero **6/6**; suite
  completa **31/31 en 6,1 min** (última corrida, ver §17); typecheck, lint y
  build en **0**.

## 16. Mensaje corporativo movido y cards unificadas (2026-11-19)

Reubicación del mensaje corporativo y alineación de las tarjetas de banner con el
patrón de Logos. Sin cambios de contrato ni de sistema visual.

- **Mensaje corporativo fuera de Anuncios.** El bloque ES/EN ya no vive en
  Anuncios de portada: se movió a Marketing Jovy
  (`/app/jovy-herramientas/marketing`) con `CorporateMessagePanel` +
  `CorporateMessageForm`, porque es el texto que aparece bajo la animación del
  Hero. El orden de Marketing queda **Hero → Mensaje corporativo → enlace «Abrir
  Anuncios de portada»**. Anuncios conserva solo banners/anuncios (`promo` y
  `hint`). La E2E del mensaje corporativo se movió a `jovy-hero.spec.ts`; la de
  Anuncios quedó centrada en banners. Testid del bloque:
  `marketing-corporate-block`.
- **Cards de banner unificadas con Logos.** Mismo shell: `rounded-md`, `p-3`,
  sombra, imagen 16:9, cuerpo con badges, título `h3` de 16 px y acciones al pie
  con `border-t`. Los badges pasan a tamaño normal y el grid es
  `sm:grid-cols-2 lg:grid-cols-4`. Quedan diferencias residuales: la card de
  banner es ~12 px más estrecha por los `Container` anidados y por contenido
  extra (EN, vigencia, detalles); no se consideran un diseño distinto.
- **Incidencia de validación.** Una edición previa dejó
  `announcements/page.tsx` con el import viejo
  `./components/corporate-message-form`, que tumbó Vite en la suite completa
  (10 fallos). Se restauró la página simplificada y la suite volvió a verde. Se
  documenta como incidencia de validación, no como parte de este ajuste.
- **Evidencia.** Bajo
  [`audit-announcements-cards/`](../.test-results/audit-announcements-cards/)
  (raíz del repo): `final-4col/` con `metrics-4col.json` y `report-4col.md`; y
  bajo
  [`audit-announcements-unified/`](../.test-results/audit-announcements-unified/).
- **Verificación.** E2E enfocada **7/7**; suite completa **30/30 en 6,3 min**;
  typecheck, lint y build en **0**.

## 17. Subir/Bajar en banners (2026-11-19)

Corrección del reordenamiento en las tarjetas de banner del gestor de
`/app/jovy/announcements`. Sin cambios de contrato, de backend ni de sistema visual.

- **Causa.** `Subir/Bajar` calculaba la posición sobre `items` (todas las tarjetas)
  aunque la vista estuviera filtrada, y el orden real lo domina `priority`: mover un
  banner de prioridad 1 sobre uno de 2 solo cambiaba `sort_order` y el movimiento no
  se veía.
- **Corrección.** La acción opera sobre la lista filtrada. Si el destino tiene la misma
  prioridad, reordena `sort_order` reconstruyendo el array global (conserva los banners
  no visibles en su sitio). Si tiene prioridad distinta, pide confirmación y
  **intercambia las prioridades** de ambos banners para que el movimiento se refleje;
  al cancelar no se muta nada. Los ítems se deshabilitan cuando no hay destino visible
  en esa dirección.
- **Nota visible en la UI.** «Subir/Bajar reordena la vista; si cambia de prioridad, se
  intercambian las prioridades».
- **E2E nueva.** `jovy-banners.spec.ts` crea dos banners con prioridad `10` y `5`, sube
  el de `5` con confirmación y verifica prioridades `[5, 10]` y el orden visual
  invertido en las tarjetas. La prueba de misma prioridad se conserva.
- **Verificación.** E2E de Banners **3/3**; suite completa **31/31 en 6,1 min**;
  typecheck, lint y build en **0**.

## 18. Estado

`VALIDADO` **con revisión pendiente**. No se declara «réplica aceptada» ni
paridad total: este trabajo es de pulido visual local, no de equalización con el
admin histórico. Quedan para revisión los objetivos táctiles de los dos iconos
de la bandeja y la convivencia de radios heredados (4/8/12/9999 px) en los
componentes nativos.

**Sin commits ni pushes** en este trabajo, ni en el repo de JovyCandy ni en el
del kit de DevKit. Los cambios quedan en el árbol de trabajo.
