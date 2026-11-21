# Auditoría con Modern Web Guidance (Google Chrome)

**Corte:** 2026-11-21
**Objetivo:** auditar el diseño implementado del storefront con las guías de `modern-web-guidance`.
**Alcance:** Home `/es`, producción local (`next start`), Lighthouse mobile + inspección del DOM/árbol de accesibilidad.
**Build auditado:** `apps/storefront` compilado con `next build`; servidor en `localhost:3001`.
**Estado:** auditoría inicial + implementación posterior de los P0. Las puntuaciones de la sección 1 son las de la última medición tras los cambios.

## 0. Resumen de implementación P0

| P0 | Estado | Evidencia |
|---|---|---|
| Imágenes y vídeo optimizados | **IMPLEMENTADO** | Variantes 240–1200 px, `srcset`/`sizes`, vídeo `preload="none"` + poster + IntersectionObserver; frames del logo progresivos |
| Contraste corregido | **IMPLEMENTADO** | Lighthouse `color-contrast` = 1 |
| `<h1>` y skip link | **IMPLEMENTADO** | h1 oculto y enlace “Saltar al contenido” |
| Diálogos y menú nativos | **IMPLEMENTADO** | `<dialog>` + `showModal()`, `Escape`, backdrop, foco e inert nativo |

P1 implementados: objetivos táctiles de 44 px, labels/`autocomplete` del formulario y favicon. La pausa de movimiento se añadió y después se retiró por decisión de producto: las animaciones del hero y del logo no las detiene el usuario; `prefers-reduced-motion` sigue cubierto. LCP sigue por encima de 2,5 s (**3,9 s**), así que ese objetivo queda **PENDIENTE**.

Puntuación final: **Performance 85 · Accessibility 100 · Best Practices 100 · SEO 100**.
LCP **3,9 s**, CLS **0**, peso total **1,36 MB** (antes 21,1 MB).

## 1. Puntuación Lighthouse

| Categoría | Puntuación |
|---|---:|
| Performance | **85** |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | **100** |

Métricas principales:

| Métrica | Valor |
|---|---:|
| First Contentful Paint | 1,1 s |
| Largest Contentful Paint | **3,9 s** |
| Total Blocking Time | 200 ms |
| Cumulative Layout Shift | **0** |
| Speed Index | 3,0 s |
| Peso total de red | **1,36 MB** |

> Medición mobile con throttling de Lighthouse sobre build de producción local. No sustituye una prueba de campo ni un dispositivo real.

## 2. Hallazgos priorizados (estado inicial)

> Los P0 siguientes describen la auditoría inicial y **ya fueron corregidos** (sección 0). Se conservan como evidencia.

### P0 · LCP de 6,8 s por imágenes sobredimensionadas y vídeo pesado

Evidencia:

- El hero descarga `mini-sharks.webp` de **698 KB** con dimensiones naturales **2508×2881** y se muestra a **526×604**.
- Lighthouse estima **1.004 KiB** de ahorro solo en imágenes.
- Las tarjetas de Novedades descargan **2,3–2,9 MB** por imagen.
- `JOVY-CALIDAD.webm` pesa **7,3 MB** y aparece entre los mayores recursos.
- Peso total: **21,1 MB**.

Guías aplicables:

- `optimize-image-priority`: la imagen LCP debe estar en el HTML, con `fetchpriority="high"`, sin `loading="lazy"`.
- `responsive-design` / `performance`: usar `srcset`/`sizes`, AVIF/WebP y dimensiones explícitas.
- `performance`: no cargar vídeo pesado fuera del viewport.

Corrección recomendada:

1. Generar variantes responsive (400/800/1200/1600 px) para hero, eventos, galería y categorías.
2. Servir AVIF con fallback WebP.
3. Migrar a `next/image` o `<picture>` con `sizes`.
4. Preload del hero con `imagesrcset`/`imagesizes`.
5. Vídeo de “Nuestra esencia” con `preload="none"` + poster + reproducción al entrar en viewport.
6. Comprimir eventos a ~150–300 KB.

### P0 · Contraste insuficiente

Lighthouse detecta cuatro nodos con contraste insuficiente:

| Elemento | Ratio | Mínimo AA |
|---|---:|---:|
| CTA “TIENDA” blanco sobre turquesa `#00AFAA` | 2,36:1 | 4,5:1 |
| “CATÁLOGO DE PRODUCTOS” gris sobre blanco | 3,12:1 | 4,5:1 |
| Eyebrows rosas `#ff5f9a` sobre blanco | 2,74:1 | 4,5:1 |
| Texto blanco sobre certificaciones `#ff6a86/#ff7f69` | 2,47–2,74:1 | 4,5:1 |

Cálculos propios:

- Blanco sobre `#00AFAA`: **2,72:1**.
- Blanco sobre `#007F7B`: **4,86:1**.
- Blanco sobre `#ff6a86`: **2,74:1**.

Guía: `contrast-color` — objetivo mínimo **4,5:1** para texto normal, **3:1** para texto grande.

Corrección:

- Usar `#007F7B` como fondo de texto sobre turquesa, o añadir un scrim oscuro localizado.
- Oscurecer eyebrows rosas a un tono ≥4,5:1.
- Cambiar el título del catálogo a `stone-600` (`#564d46`, 7,57:1 sobre blanco).
- En certificaciones, añadir overlay oscuro o usar texto oscuro sobre rosa claro.

### P1 · No existe `<h1>`

Auditoría del DOM:

```text
h1: []
headings: H2:Novedades, H2:Certificaciones, H3:...
```

Guía: `accessibility` — una página debe tener una estructura de encabezados navegable y un `h1` que describa el contenido principal.

Corrección: añadir un `h1` visible o visualmente oculto (“Jovy Candy — Dulces mexicanos”) y mantener la jerarquía H1 → H2 → H3.

### P1 · 41 de 43 imágenes sin `width`/`height`

Lighthouse: `unsized-images` con score 0,5. El CLS actual es 0, pero el riesgo aumenta con caché fría, fuentes o cambios de red.

Guías: `performance` y `responsive-design`.

Corrección: dimensiones explícitas o `aspect-ratio` en todos los contenedores; `width`/`height` en logos, iconos y tarjetas.

### P1 · Diálogos y menú móvil no usan `<dialog>`

Estado actual:

- Modal de contacto/ubicación: `div` con `role="dialog"` y `aria-modal="true"`.
- `main` **no queda inert** al abrir el modal.
- No hay focus trap nativo; el foco puede salir al fondo.
- El menú móvil es un overlay custom.

Guías:

- `dialog`: “Use the native `<dialog>` element… accessibility semantics, focus handling, top-layer rendering and Esc handling”.
- `prevent-page-scroll-under-modal-dialog`: contener el scroll en `dialog`/`::backdrop`.
- `navigation-drawer`: implementar el drawer con `<dialog>`.

Corrección: migrar a `<dialog>` + `showModal()`, `closedby`, `::backdrop`, foco inicial y restauración; menú móvil como drawer nativo.

### P1 · Objetivos táctiles por debajo de 44 px

Medición:

- Pills del header: **36 px** de alto.
- Redes del header: **32×32 px**.
- Enlaces del footer: **24 px** de alto.

Guía: `accessibility` / WCAG 2.2 — objetivo táctil mínimo recomendado 44×44 CSS px.

Corrección: aumentar padding/min-height sin cambiar la estética; para iconos, área táctil de 44 px.

### P1 · Movimiento automático sin control de pausa

La Home tiene:

- 10 filas de marquesina “NUEVO PRODUCTO” en movimiento infinito.
- Animación de scroll de 60 frames.
- Vídeo de “Nuestra esencia” en autoplay.

Guía: `motion` — contenido que se mueve automáticamente durante más de 5 s necesita un control visible de pausa/stop (WCAG 2.2.2). `prefers-reduced-motion` no sustituye ese control.

Corrección aplicada inicialmente: botón “Pausar animaciones” accesible. **Decisión posterior de producto:** se retiró el botón porque la animación del hero y del logo es parte fija de la experiencia. Se mantiene `prefers-reduced-motion` como mitigación, pero el criterio WCAG 2.2.2 queda como **riesgo residual aceptado** y no como implementación completa.

### P1 · Formulario de contacto

Hallazgos:

- Las etiquetas son implícitas; no hay `for`/`id` explícitos.
- No hay `autocomplete` (`name`, `email`, `tel`, `country`).
- No hay `aria-invalid` ni `aria-describedby` para errores.
- El foco inicial puede caer en el honeypot si se altera el orden.

Guías: `accessibility` — asociar `label` con `for`/`id`; anunciar errores; no ocultar campos de forma que confunda a lectores de pantalla.

Corrección: IDs estables, `autocomplete`, `aria-invalid`, mensajes asociados, foco al primer campo real.

### P2 · `favicon.ico` 404

Lighthouse `errors-in-console`:

```text
Failed to load resource: 404 /favicon.ico
```

Corrección: `app/icon.png` o `<link rel="icon" href="/favicon.png">`.

### P2 · `@import` en CSS

`globals.css` usa `@import` para tipografía y estilos legacy. La guía `performance` indica: “DON'T use `@import` in CSS” porque crea cadenas de peticiones.

En Next/Tailwind el bundler puede resolverlo, pero conviene consolidar los CSS legacy en una sola entrada o importarlos desde el layout con orden explícito.

### P2 · Peso de JavaScript / bfcache

- `unused-javascript`: ~314 KiB estimados.
- `bootup-time`: 2,2 s.
- bfcache bloqueado por `Cache-Control: no-store` y WebSocket de desarrollo/herramientas.

El build de producción reduce parte de esto; aun así conviene revisar chunks de cliente y no montar canvas/motion hasta que sea necesario.

## 3. Lo que está bien

- **CLS 0**: la composición no salta en la medición.
- **SEO 100**: title, description, canonical, `hreflang`, robots y sitemap.
- **43 imágenes con `alt`** (incluidas decorativas con `alt=""`).
- Landmarks: `header`, `main`, `footer`, `nav`.
- `prefers-reduced-motion` implementado en CSS y en el canvas del logo.
- Catálogo con `aria-pressed` en las tarjetas.
- Modal con `role="dialog"`, `aria-modal`, cierre con Escape y bloqueo de scroll.
- Sin errores de consola salvo el favicon 404.

## 4. Plan recomendado

### P0 — antes de seguir con ecommerce

1. Optimizar hero/eventos/video y añadir `srcset`/`sizes`.
2. Corregir contraste de hero, certificaciones, eyebrows y título de catálogo.
3. Añadir `h1`.
4. Migrar modales/menú a `<dialog>`.

### P1 — siguiente iteración

5. Dimensiones explícitas en todas las imágenes.
6. Objetivos táctiles ≥44 px.
7. Pausa de animaciones.
8. Formulario con labels/autocomplete/errores accesibles.
9. Favicon.

### P2 — rendimiento continuo

10. Consolidar CSS legacy.
11. Revisar chunks JS y `content-visibility` en secciones largas.
12. Repetir Lighthouse en staging con HTTPS y red real.

## 5. Limitaciones

- Lighthouse mobile sobre servidor local; no sustituye field data (CrUX/RUM).
- No se ejecutó lector de pantalla real (NVDA/VoiceOver).
- No se probó con red 3G real ni dispositivo de gama baja.
- La auditoría es de diseño/frontend; no cubre la seguridad del Admin.

## 6. Modern Web Guidance

Guías consultadas y aplicadas al análisis:

- **`optimize-image-priority`**: se comprobó que el hero tiene `fetchpriority="high"` y no es lazy, pero el archivo es sobredimensionado (“This image file is larger than it needs to be… Use responsive images”).
- **`performance`**: se identificó el peso de 21 MB, el vídeo de 7,3 MB y el uso de `@import` (“DON'T use `@import` in CSS”).
- **`responsive-design`**: faltan `srcset`/`sizes` en imágenes responsivas.
- **`dialog`**: los overlays custom no usan `<dialog>` ni el foco/inert nativo (“Use the native `<dialog>` element…”).
- **`prevent-page-scroll-under-modal-dialog`**: el bloqueo actual es `body.overflow`, no contención nativa del diálogo.
- **`contrast-color`**: los ratios medidos quedan por debajo de 4,5:1.
- **`motion`**: la marquesina y el vídeo automático requieren control de pausa.
- **`navigation-drawer`**: el menú móvil debería ser un drawer `<dialog>`.

Se aplicaron las correcciones P0 descritas en la sección 0; las P1/P2 permanecen pendientes salvo favicon, `h1` y skip link.
