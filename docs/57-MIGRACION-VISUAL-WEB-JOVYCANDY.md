# Migración visual desde `web-jovycandy`

**Corte:** 2026-11-21
**Proyecto nuevo:** `opdatos-del/jovycandy-store` · `42457ec`
**Proyecto histórico:** `C:\Users\opdatos\Documents\github\jovycandy-com-mx\web-jovycandy`
**Remoto histórico:** `https://github.com/jovycandy-web/web-jovycandy.git`
**Rama histórica:** `dev`
**Commit histórico de referencia:** `b496a95e4391b44fab484c2a79bfbb43027f2d86`
**Sitio publicado:** `https://jovycandy.com.mx/`

## 1. Verificación de la fuente

| Campo | Valor |
|---|---|
| Framework histórico | React 19 + Vite 6 + Tailwind 4 |
| Animación | `motion` (Framer Motion) |
| i18n | `i18next` + `react-i18next` |
| Estructura | `features/`, `app/`, `shared/`, `styles/` |
| Assets versionados | `public/assets`, `public/videos` (≈38 MB) |
| Estado del repo histórico | Rama `dev` con cambios locales sin tocar; **no se modificó** |
| Diferencias con el sitio publicado | El sitio publicado carga imágenes de producto/eventos desde `admin.jovycandy.com.mx/uploads`; el repositorio no las incluye |

El sitio publicado y el repositorio comparten la misma estructura visual: hero con animación del logo, marquesina “NUEVO PRODUCTO”, hero de producto, Novedades, Certificaciones, selector de categorías, Casa Jovy, Nuestra esencia y footer turquesa. Se priorizó la apariencia publicada y se usó el código histórico para recuperar clases, composición y comportamiento.

## 2. Estrategia

No se copió la aplicación Vite como dependencia ni se levantó un segundo frontend. Se portó la experiencia a Next.js 16 App Router:

- Server Components para contenido y datos CMS.
- Client Components solo para menú móvil, scroll del logo, selector de categorías y modales.
- CSS histórico copiado a `src/styles/legacy/` y cargado desde `globals.css`.
- Assets históricos copiados a `public/` sin recomprimir.
- Imágenes de producto/eventos del sitio oficial descargadas solo cuando no existían en el repositorio, con procedencia documentada en `docs/58`.
- El CMS de Medusa es la fuente de verdad cuando tiene contenido; si está vacío, se usa contenido editorial de respaldo claramente identificado.

## 3. Correspondencia de componentes

| Histórico | Nuevo | Estado |
|---|---|---|
| `app/App.tsx` | `src/app/[locale]/layout.tsx` + `page.tsx` | Migrado con estructura distinta |
| `app/navigation/AppNavbar*` | `components/layout/site-header.tsx` | Migrado; menú móvil, pills ES/EN y “Próximos Eventos” abre el modal de anuncios en lugar de navegar |
| `app/layout/AppSections.tsx` | `app/[locale]/page.tsx` | Migrado |
| `features/scroll-logo/ScrollLogo.tsx` | `components/home/scroll-logo.tsx` | Animación de scroll con 60 frames, reducida a 150svh |
| `features/hero/Hero.tsx` + hooks | `components/home/hero-promo.tsx` | Conserva marquesina, destello giratorio, rotación de productos y CTA |
| `features/events-gallery/UpcomingEvents.tsx` | `components/home/events-section.tsx` | Carrusel con tarjetas tipo póster y ola hacia Certificaciones; sin modal de video |
| `features/certifications/Certifications.tsx` | `components/home/certifications.tsx` | Migrado |
| `features/catalog/CategoryGrid.tsx` | `components/home/category-explorer.tsx` | Migrado con panel de productos y estados |
| `features/tagline/TaglineSection.tsx` | `components/home/casa-jovy.tsx` | Migrado; galería y redes |
| `features/about/About.tsx` | `components/home/about-section.tsx` | Layout de dos columnas: video con título superpuesto y capas Misión/Visión/Valores con iconos, acordeón móvil y rejilla de valores en escritorio |
| `app/layout/AppFooter.tsx` | `components/layout/site-footer.tsx` | Migrado; feed social |
| `features/contact/ContactModal.tsx` | `components/dialogs/contact-dialog.tsx` | Migrado; 4 bandejas y POST real |
| `features/location/LocationModal.tsx` | `components/dialogs/location-dialog.tsx` | Migrado |
| `features/lang-selector` | enlaces `/es` y `/en` | Sustituido por rutas localizadas |
| `features/promo-banner/PromoBanner.tsx` | `components/dialogs/upcoming-events-dialog.tsx` | **IMPLEMENTADO**: modal con banners `promo` del CMS + eventos como anuncios, carrusel, auto-open por frecuencia y disparo desde el header |
| `features/intro/Intro.tsx` | no usado | El histórico tampoco lo monta en `AppSections` |
| `features/catalog` carrusel/technical sheet | panel simplificado | **PENDIENTE** de paridad completa |

## 4. Sistema visual

Valores extraídos del CSS histórico y conservados:

| Token | Valor |
|---|---|
| Fondo base | `#fff5d4` (ivory) |
| Fondo hero | `#edf5ff` (azul pálido) |
| Azul de marca | `#0d3b6e` / `#083b7a` |
| Turquesa footer | `#00AFAA` |
| Turquesa hero “NUEVO PRODUCTO” | `#00AFAA` (igual al footer) |
| Fondo Novedades | `#fff5d4 → #fff8e0 → #fff5d4` |
| Transiciones | Olas SVG entre hero→Novedades→Certificaciones→Catálogo→Casa Jovy→Esencia→footer |
| Rosa de acento | `#ff5f9a` / `#ff6a86` |
| Coral certificaciones | gradiente `#ff6a86 → #ff7f69` |
| Tipografía | `Arial Narrow`, Arial, Helvetica |
| Radios y tipografía fluida | `tokens.css` histórico (`--section-gutter`, `--section-space`, `--hero-max-width`, etc.) |
| Breakpoints | 360, 390, 430, 640, 768, 1024, 1280, 1536, 1920, 2240, 2560, 3440 |

No se introdujo una paleta nueva. Las clases y variables históricas se conservan en `src/styles/legacy/`.

## 5. Animaciones

| Animación histórica | Implementación nueva | Estado |
|---|---|---|
| Logo que se transforma en ositos durante el scroll | Canvas con 60 frames y progreso de scroll, sección de 150svh (la histórica usaba 310svh); el claim “Es tu mejor selección” se revela al completar la animación | **PARIDAD VISUAL Y FUNCIONAL** |
| Marquesina de fondo “NUEVO PRODUCTO” | Filas CSS con `hero-backdrop-track-forward/reverse` | **IMPLEMENTADA** |
| Destello de luz giratorio del hero | Rayos con `repeating-conic-gradient` y máscara radial sobre `hero-rays-spin` | **IMPLEMENTADO** |
| Rotación automática de productos del hero | Rotación cada 4 s con fundido entre productos del CMS, con respaldo del catálogo local | **IMPLEMENTADO** |
| Aparición de secciones | Transiciones CSS y animaciones históricas | **PARCIAL** (no todas las variantes `motion`) |
| Carrusel de Novedades con drag | Scroll horizontal con arrastre de puntero, flechas, indicadores y `snap` | **IMPLEMENTADO** |
| Modal de evento con video | `<dialog>` nativo con imagen completa o vídeo y cierre por fondo/Escape | **IMPLEMENTADO** |
| Selector de categoría con panel | Estado React y panel inline | **IMPLEMENTADO** |
| Lightbox de galería Casa Jovy | No implementado | **PENDIENTE** |
| Menú móvil | Overlay con bloqueo de scroll | **IMPLEMENTADO** |
| `prefers-reduced-motion` | Logo estático y CSS global reduce | **IMPLEMENTADO** |

## 6. Contenido y CMS

Contratos consumidos:

- `GET /store/jovy/marketing/hero`
- `GET /store/jovy/marketing/banners/promo`
- `GET /store/jovy/events`
- `GET /store/jovy/catalogue/categories`
- `GET /store/jovy/products`
- `GET /store/jovy/brand/gallery`
- `GET /store/jovy/announcements/settings`
- `POST /store/jovy/contacts` (a través de `/api/contact` del storefront)

Los fetch se ejecutan en servidor con `x-publishable-api-key`; la clave nunca llega al navegador. Si el backend no responde, se usa contenido de respaldo y el build no falla.

## 7. URLs

| Histórica | Nueva | Acción |
|---|---|---|
| `/` | `/es` (307) | Redirección |
| `/#inicio` | `/es#inicio` | Ancla |
| `/#eventos` | `/es#eventos` | Ancla |
| `/#certificaciones` | `/es#certificaciones` | Ancla |
| `/#tienda` | `/es#tienda` y `/es/catalogo` | Ancla + catálogo |
| `/#nuestra-esencia` | `/es#nuestra-esencia` | Ancla |
| — | `/en` | Nuevo idioma |
| — | `/es/productos/[handle]` | Nueva ficha |
| — | `/api/contact` | Proxy server-side |

Las URLs históricas de páginas corporativas y productos del sitio publicado aún no se inventarieron por completo; **PENDIENTE** de mapa definitivo y redirects.

## 8. QA visual

Capturas en `docs/assets/parity-2026-11-21/`:

| Archivo | Qué muestra |
|---|---|
| `official-home-1440.png` | Sitio oficial, primer viewport |
| `new-home-1440.png` | Nuevo hero de producto |
| `new-catalogo-1440.png` | Selector de categorías |
| `new-footer-1440.png` | Footer social |
| `new-home-mobile-375.png` | Home móvil |
| `new-contacto-1440.png` | Modal de contacto |
| `official-full-1920.png` | Captura completa del sitio oficial (secciones lazy incompletas) |

Diferencias conocidas:

- El header nuevo usa pills con los mismos colores y jerarquía, pero no replica el selector de bandera ni el modal de idioma.
- La intro de marca conserva la animación de frames con scroll, pero dura 150svh en lugar de 310svh para no secuestrar la navegación.
- El carrusel de Novedades no abre el modal de video histórico.
- La galería Casa Jovy no tiene lightbox.
- El hero rota productos como el sitio publicado: usa los productos del CMS con imagen válida y, mientras el contenido local sea demo, cae al catálogo oficial de respaldo.
- Novedades y Certificaciones se separan con una franja crema y una onda superior en la sección roja, para que ambas secciones no se mezclen.
- El contenido local del CMS es demo; por eso el fallback editorial usa assets oficiales.

## 9. Pruebas ejecutadas

| Check | Resultado |
|---|---|
| `next typegen && tsc --noEmit` | PASS |
| `next build` | PASS |
| `eslint` | 0 errores; 19 warnings `no-img-element` |
| Home `/es` | 200 |
| `/en` | 200 |
| `/es/catalogo` | 200 |
| `/es/productos/t-shirt` | 200 |
| `POST /api/contact` inválido | 400 |
| Redirección `/` → `/es` | 307 |
| Revisión visual 1440/375 | Realizada con navegador Brave |

## 10. Riesgos y pendientes

- **No hay commit ni push** de esta entrega; el árbol está modificado.
- Los enlaces de producto del fallback sin `handle` llevan al catálogo, no a una ficha individual.
- El carrito, checkout y cuentas **no están implementados** en esta entrega.
- El lightbox de galería de Casa Jovy sigue pendiente; los modales de evento, anuncios y promo ya están implementados.
- El contenido CMS local es demo; la paridad editorial final depende de cargar contenido real.
- Las imágenes usan `<img>` en varios puntos; queda pendiente migrar a `next/image` con `remotePatterns` y medir LCP.
- La página de producto solo resuelve productos CMS con `handle`; los fallbacks no tienen ficha propia.
- `robots.txt` y `sitemap.xml` están implementados; falta el inventario completo de URLs históricas, redirects 301, datos estructurados y Open Graph por producto.
- No se validó accesibilidad con auditoría automatizada; solo revisión básica de teclado/etiquetas.
