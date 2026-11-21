# Matriz de paridad del sitio corporativo

**Corte:** 2026-11-21
**Referencia:** sitio publicado `https://jovycandy.com.mx/` + `web-jovycandy@b496a95`
**Nuevo:** `apps/storefront` (Next.js 16)
**Criterio:** no se declara paridad completa por tener la misma sección; se exige composición, assets, comportamiento y responsive comprobados.

## 1. Matriz

| Sección | Histórico | Nuevo | Estado | Evidencia / diferencia |
|---|---|---|---|---|
| Header / navegación | Logo, Próximos Eventos, Contacto, Ubicación, redes, ES | Pills equivalentes, menú móvil, enlaces ES/EN | **PARIDAD VISUAL Y FUNCIONAL** con diferencia justificada | Captura `new-home-1440.png`; el selector de bandera/modal se sustituye por `/es` y `/en` |
| Animación de logo | Canvas de 60 frames al scroll | Canvas de 60 frames, 150svh | **PARIDAD VISUAL Y FUNCIONAL** | Se redujo la altura de 310svh a 150svh |
| “Es tu mejor selección” | Imagen sobre el logo animado | Asset oficial `/brand/hero/es-tu-mejor-seleccion.webp` | **PARIDAD VISUAL** | Captura móvil |
| Hero de producto | Producto grande, marquesina, CTA | `MINI SHARKS` oficial, marquesina, CTA a catálogo | **EVOLUCIÓN COMERCIAL ADITIVA** | Captura `new-home-1440.png` |
| Novedades | Carrusel horizontal + modal de video | Tarjetas póster sobre fondo ivory y ola a Certificaciones; sin modal | **PARIDAD VISUAL ALTA** | Pendiente modal de video |
| Hero “NUEVO PRODUCTO” | Fondo turquesa, marquesina, producto | Fondo turquesa igual al footer, ola superior, marquesina y producto | **PARIDAD VISUAL ALTA** | CTA adicional a catálogo |
| Certificaciones | Banda coral, copy, 3 PDFs | Misma banda, copy y PDFs | **PARIDAD VISUAL Y FUNCIONAL** | Certificaciones verificadas en navegador |
| Selector de categorías | 6 tarjetas + carrusel de producto + ficha técnica | 6 tarjetas + panel de productos; sin ficha técnica | **PARIDAD VISUAL ALTA**; carrusel simplificado | Captura `new-catalogo-1440.png` |
| Casa Jovy / galería | Copy, redes, galería, lightbox | Copy, redes y galería; sin lightbox | **PARIDAD VISUAL ALTA**; lightbox pendiente | Captura de sección |
| Nuestra esencia | Video, misión, visión, valores | Video, misión, visión y 6 valores | **PARIDAD VISUAL Y FUNCIONAL** | Captura de sección |
| Footer | Logo, Hechos para convivir, links, feed IG/FB | Mismo contenido y composición | **PARIDAD VISUAL Y FUNCIONAL** | Captura `new-footer-1440.png` |
| Modal de contacto | 4 temas, formulario, honeypot, éxito | 4 temas, formulario, honeypot, POST a Medusa | **PARIDAD FUNCIONAL** | Captura `new-contacto-1440.png` |
| Modal de ubicación | Mapa, dirección, teléfono, horario, email | Mismo contenido y mapa embebido | **PARIDAD FUNCIONAL** | Revisión en navegador |
| Selector de idioma | Modal con banderas | Rutas `/es` y `/en` + switch | **EVOLUCIÓN TÉCNICA** | URLs localizadas; sin modal |
| Promo banner | Banner promocional con frecuencia | No implementado | **PENDIENTE** | Requiere definir dónde se abre y frecuencia |
| PWA | `vite-plugin-pwa` histórico | No implementado | **PENDIENTE** | Next 16 soporta PWA; no se añadió |
| Cookie consent | Banner histórico | No implementado | **PENDIENTE** | Requiere decisión legal/analytics |
| Easter egg | Confetti/logo | No implementado | **PENDIENTE** | Detalle lúdico |
| Catálogo completo | Carrusel + ficha técnica | Página de catálogo + filtros + ficha CMS | **EVOLUCIÓN COMERCIAL ADITIVA** | `/es/catalogo` |
| Carrito | No existía | No implementado | **PENDIENTE** | Siguiente entrega ecommerce |
| Checkout | No existía | No implementado | **PENDIENTE** | Requiere región/envío/pago DEMO |
| Cuentas | No existían | No implementado | **PENDIENTE** | Usar módulos nativos |
| SEO / URLs | SPA con `sitemap.xml` y `robots.txt` | Metadata, canonical, alternates; mapa incompleto | **PARCIAL** | Falta inventario de URLs y redirects |
| Responsive | Breakpoints amplios | 375/768/1440/1920 revisados | **PARCIAL** | Falta 1920 formal y pruebas automatizadas |
| Accesibilidad | Sin auditoría formal | Etiquetas, foco, Escape, teclado básico | **PARCIAL** | Falta WCAG 2.2 AA automatizada |
| Rendimiento | Imágenes sin `next/image` | `<img>` en varios puntos | **PENDIENTE** | Migrar a `next/image`, medir LCP/CLS |

## 2. Diferencias justificadas

1. **Idioma:** el histórico abría un modal y guardaba la preferencia; el nuevo usa rutas `/es` y `/en`, mejores para SEO y `hreflang`.
2. **Hero:** el sitio publicado rota promociones desde su API; el nuevo usa CMS y fallback oficial. La geometría y el lenguaje visual se conservan.
3. **Categorías:** el histórico abre un carrusel con logos y ficha técnica; el nuevo abre un panel de productos y enlaza al catálogo. La retícula y assets son los mismos.
4. **Datos:** el CMS local tiene contenido demo (T-shirts, diagramas). El fallback editorial usa assets oficiales para no romper la identidad visual.

## 3. Pendientes que impiden declarar paridad total

- [ ] Modal de video de Novedades.
- [ ] Lightbox de Casa Jovy.
- [ ] Promo banner y frecuencia.
- [ ] Carrusel de logos y ficha técnica por producto.
- [ ] PWA y consentimiento de cookies.
- [ ] Inventario completo de URLs y redirects 301.
- [ ] `sitemap.xml`, `robots.txt` y datos estructurados.
- [ ] Migración a `next/image`.
- [ ] Auditoría WCAG 2.2 AA.
- [ ] Pruebas visuales automatizadas 375/768/1440/1920.
- [ ] Carrito, checkout DEMO y cuentas.
- [ ] Contenido CMS real (el actual es demo).

## 4. Conclusión

La Home corporativa, el sistema visual, los assets principales, el header, hero animado, certificaciones, categorías, Casa Jovy, esencia, footer y contacto ya están migrados y verificados visualmente. **No se declara paridad completa**: faltan interacciones secundarias, ecommerce y SEO/URLs. El estado global de la entrega es **EN VALIDACIÓN**, no completado.
