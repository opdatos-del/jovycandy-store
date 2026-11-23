# Productos, precios e inventario

**Estado:** IMPLEMENTADO EN LABORATORIO.

## Fuente

- Editorial: `/store/jovy/products` (Jovy CMS).
- Comercial: `/store/products?region_id=...` (Medusa Store API).
- Región: México (`mxn`), creada por `seed:commerce`.
- Precio: `variants.calculated_price.calculated_amount`.

## Mapper

`src/lib/medusa/store.ts` combina:

- `id`, `handle`, `title`, `thumbnail`;
- variantes: `id`, `title`, `sku`;
- `manage_inventory`, `allow_backorder`, `inventory_quantity`;
- precio calculado y moneda.

El catálogo muestra el precio de la primera variante con precio; la ficha usa el precio de la variante seleccionada.

## Reglas

- Un producto sin precio no es comprable.
- Una variante sin precio se deshabilita.
- `CATALOG_ONLY` nunca habilita carrito.
- `manage_inventory=false` no se presenta como stock verificado; se considera no gestionado.
- Si Medusa no responde, el catálogo conserva la presentación y la ficha muestra precio no disponible.
- El cliente nunca envía precio, moneda ni total: el BFF y Medusa los recalculan.

## Seed

`seed:catalog` crea 25 productos, una variante y un precio MXN por producto. Los importes son de desarrollo.

## Pendiente productivo

- Revisar precios/certificaciones e imágenes remotas.
- Definir stock real y reglas de inventario.
- Añadir variantes múltiples por presentación cuando el catálogo comercial lo requiera.
