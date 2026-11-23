# Design system del catálogo JovyCandy

## 1. Principio

El catálogo oficial extiende la identidad JovyCandy sin modificar tokens globales. Los estilos viven en `src/styles/catalog/catalog.css` y usan el prefijo `.catalog`; retirar la hoja y las rutas elimina el catálogo sin afectar Home.

El header corporativo permanece transparente y el contenido reserva su altura.

## 2. Tokens

| Rol | Token | Valor |
|---|---|---|
| Fondo crema | `--catalog-ivory` | `#fff5d4` |
| Superficie | `--catalog-paper` | `#fffdf7` |
| Marca/CTA | `--catalog-blue` | `#0d3b6e` |
| Acento aqua | `--catalog-aqua` | `#00afaa` |
| Acento rosa | `--catalog-pink` | `#ff5f9a` |
| Acento coral | `--catalog-coral` | `#ff6a86` |
| Texto secundario | `--catalog-muted` | `#5b6f82` |
| Línea | `--catalog-line` | `color-mix(in srgb, var(--catalog-blue) 16%, transparent)` |
| Foco | `--catalog-focus` | `#0d3b6e` |

- Tipografía: familia sans corporativa (`Arial Narrow`, Arial, Helvetica).
- Focus: contorno azul de 3 px y offset de 3 px.
- Touch: controles de al menos 44 px en puntero grueso.
- Movimiento: transiciones cortas, anuladas con `prefers-reduced-motion: reduce`.
- Radios: tarjetas de `0.8rem`, controles de `0.55rem`, píldoras para badges y CTAs.

## 3. Gramática visual

- catálogo a ancho completo, sin contenedor centrado;
- máximo 6 columnas en escritorio amplio y columnas autoajustables debajo;
- cabecera compacta con breadcrumb, título y descripción;
- sidebar sticky con filtros y scroll interno;
- tarjetas con borde fino, packshot centrado, familia, nombre, gramaje, certificaciones y CTA;
- badges “Nuevo” y “Solo catálogo”;
- ficha con packshot grande, badges, especificaciones y relacionados;
- 404 con código decorativo, breadcrumb y acciones de recuperación.

## 4. Componentes y estados

| Componente | Estados |
|---|---|
| Product card | default, hover/focus, nuevo, solo catálogo |
| Filtros | activo, sin resultados, limpiar, cero resultados, sticky |
| Búsqueda | vacía, normalizada, sin resultados |
| Grilla | 6 columnas, 5, 2/3 y 1/2 en móvil |
| Card CTA | ficha pública; sin botones deshabilitados |
| Ficha | `SELLABLE` con carrito pendiente; `CATALOG_ONLY` con contacto |
| Relacionados | familia/categoría y respaldo a otros publicados |
| 404 | producto inexistente con estado HTTP 404 |

## 5. Responsive

| Ancho | Catálogo | Ficha |
|---|---|---|
| 1920/1440 | 6/5 columnas, sidebar sticky | Dos columnas, relacionados en 4 |
| 768 | 3 columnas, filtros en diálogo | Una columna |
| 375 | 2 columnas, filtros en diálogo | Una columna |

El sidebar se oculta bajo 900 px y se reemplaza por un `<dialog>` inferior. La ficha apila galería e información y reduce especificaciones a una columna en móvil.

## 6. Accesibilidad

- landmarks, un solo `h1`, breadcrumbs etiquetados y labels explícitos;
- `<dialog>` modal con cierre visible y cierre ligero nativo;
- foco visible y orden de tabulación natural;
- imágenes de producto con `alt`; decorativas con `alt=""`;
- contraste objetivo WCAG 2.2 AA;
- carrito deshabilitado con `aria-describedby` hacia su nota explicativa;
- sin dependencia de hover para acciones esenciales.

## 7. Datos y reglas

- el catálogo solo lista productos publicados con `handle`;
- categoría por URL y resto de filtros en cliente;
- no se inventan precios, stock, descripciones ni certificaciones;
- `CATALOG_ONLY` nunca ofrece compra; la ficha muestra contacto;
- la modalidad comercial se resuelve en servidor cuando exista integración Medusa completa.

## 8. Documentos relacionados

- Catálogo: `docs/60-CATALOGO-PRODUCTOS.md`.
- Integración comercial: `docs/64-PLAN-INTEGRACION-MEDUSA-TIENDA.md`.
