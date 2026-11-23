# Catálogo de productos JovyCandy

**Estado:** IMPLEMENTADO · catálogo oficial con datos CMS. Carrito y checkout pendientes.  
**Rutas:** `/{locale}/catalogo` y `/{locale}/productos/[handle]`.  
**Alcance:** presentación y navegación del catálogo; sin cambios en Medusa, inventario, precios ni pedidos.

## 1. Experiencia

El catálogo oficial usa una composición de alta densidad inspirada en tiendas especializadas de dulces:

- cabecera compacta con breadcrumb, título y descripción;
- catálogo a ancho completo con filtros laterales persistentes;
- sidebar sticky con scroll propio cuando excede el viewport;
- tarjetas con packshot, familia, nombre, gramaje, certificaciones y CTA a ficha;
- grid de máximo 6 columnas en escritorio amplio;
- ficha de producto con galería, badges, especificaciones, acciones y relacionados;
- 404 de producto alineado a la misma identidad.

La identidad se apoya en la paleta corporativa, tipografía sans condensada, superficies blancas, bordes finos, badges tipo píldora y acentos aqua/coral.

## 2. Rutas

| Pantalla | Ruta |
|---|---|
| Catálogo ES | `/es/catalogo` |
| Catálogo EN | `/en/catalogo` |
| Ficha de producto | `/es/productos/[handle]` |
| Categoría | `/es/catalogo?categoria=chamoy` |
| Producto inexistente | 404 propia dentro de `/productos/[handle]` |

El catálogo solo muestra productos publicados con `handle`. Las fichas de respaldo sin página propia no se muestran; una categoría sin productos publicados muestra el estado vacío.

## 3. Ejecución

```powershell
pnpm dev
# o por separado:
pnpm --dir apps/backend dev
pnpm --dir apps/storefront dev

pnpm --filter storefront typecheck
pnpm --filter storefront lint
pnpm --filter storefront build
pnpm --dir apps/storefront test:e2e
```

Los E2E levantan backend y storefront si no están activos.

## 4. Implementación

```text
src/app/[locale]/catalogo/            catálogo oficial
src/app/[locale]/productos/[handle]/  ficha y 404 de producto
src/features/catalog/
├── catalog-page.tsx                  filtros, búsqueda, orden y grilla
├── product-card.tsx                  tarjeta compartida
└── product-detail.tsx                ficha, acciones y relacionados
src/styles/catalog/catalog.css         sistema visual del catálogo
e2e/catalog.spec.ts                   catálogo, ficha, responsive y 404
```

## 5. Datos

Fuente: `getHomeContent(locale)` → Store API editorial `/store/jovy/products` y categorías.

Campos usados:

- título, `handle`, thumbnail;
- familia y claves de categoría;
- gramaje y certificaciones;
- novedad y modalidad `SELLABLE` / `CATALOG_ONLY`.

No se muestran precios porque el endpoint editorial no los expone ni los inventa. Las categorías se resuelven por `?categoria=` y el resto de facetas en cliente.

## 6. Seed del catálogo

El catálogo local se puede poblar con 25 productos Jovy reales, sus categorías, familias y fichas editoriales:

```powershell
pnpm --dir apps/backend seed:catalog
# Equivalente directo:
pnpm --dir apps/backend exec medusa exec ./src/scripts/seed-jovy-catalog.ts
```

El seed es idempotente: reconoce handles existentes y completa lo que falte. Crea una variante y precio de desarrollo por producto, publica las fichas y oculta los productos demo de Medusa (`t-shirt`, `sweatpants`) del catálogo editorial. Las imágenes apuntan al CDN público de Jovy USA; precios, textos y certificaciones son datos de desarrollo editables desde el Admin.

## 7. Funcionalidad

- búsqueda por nombre, familia, gramaje, certificaciones y categoría;
- filtros de familia, gramaje, certificación, modalidad y novedades;
- conteos por faceta y opciones sin resultados deshabilitadas;
- orden por destacados, nombre y novedades;
- sidebar sticky y drawer móvil con `<dialog>`;
- tarjetas y fichas solo para productos con página pública;
- relacionados por familia/categoría, con respaldo a otros productos publicados;
- CTA de ficha; `SELLABLE` mantiene “Añadir al carrito” deshabilitado mientras no exista carrito y `CATALOG_ONLY` ofrece contacto;
- 404 propio con accesos a catálogo e inicio;
- textos ES/EN y metadata por producto.

## 8. Límites

- Carrito, checkout, precios, inventario y pedidos no están implementados en el storefront.
- La calidad del catálogo depende de los productos publicados en el CMS.
- Los filtros se resuelven en cliente; un catálogo grande requerirá búsqueda/paginación en servidor.
- No hubo prueba con usuarios ni medición de Core Web Vitals.

## 9. Documentos relacionados

- Sistema visual: `docs/62-DESIGN-SYSTEM-CATALOGO.md`.
- Integración comercial: `docs/64-PLAN-INTEGRACION-MEDUSA-TIENDA.md`.
- Inventario de assets: `docs/58-INVENTARIO-ASSETS-HISTORICOS.md`.
