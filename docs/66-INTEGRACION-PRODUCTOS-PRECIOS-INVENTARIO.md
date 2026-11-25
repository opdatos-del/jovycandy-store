# Productos, precios e inventario

**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO LOCAL.
**Fuente comercial:** catálogo oficial mexicano versionado en
`apps/backend/src/data/catalog/official-mx.json`.

## Fuente

- Editorial: `/store/jovy/products` (Jovy CMS).
- Comercial: `/store/products?region_id=...` (Medusa Store API).
- Región: México (`mxn`), creada/reparada por `seed:commerce`.
- Precio: `variants.calculated_price.calculated_amount`.
- Inventario: Medusa Inventory Module, ubicación `Jovy México Laboratorio`.

## Mapper

`src/lib/medusa/store.ts` proyecta:

- `id`, `external_id`, `handle`, título, descripción y miniatura;
- imágenes y especificaciones oficiales;
- variantes con id, SKU, gramaje, precio calculado y moneda;
- `manage_inventory`, `allow_backorder` e `inventory_quantity`;
- metadata visual y propiedad `jovy_official_managed`.

El catálogo usa el precio mínimo y lo marca como “Desde” cuando hay varias
presentaciones con precio. La ficha usa el precio de la variante seleccionada.

## Reglas

- Un producto sin precio no es comprable.
- Una variante sin precio o sin stock se muestra deshabilitada.
- `CATALOG_ONLY` nunca habilita carrito.
- `manage_inventory=false` se presenta como disponibilidad no verificada.
- Backorder solo se anuncia cuando `allow_backorder=true`.
- La cantidad no excede el stock disponible devuelto por Medusa.
- Si Medusa no responde, el catálogo conserva la presentación y muestra precio
  no disponible; si el CMS falla, muestra error y reintento.
- El cliente nunca envía precio, moneda ni total.

## Seed oficial

```powershell
$env:OFFICIAL_SEED_MODE="preview"
pnpm --dir apps/backend seed:official

$env:OFFICIAL_SEED_MODE="apply"
pnpm --dir apps/backend seed:official
```

Crea 35 productos y 61 variantes oficiales. Es aditivo, serializado con el
Locking Module y resuelve identidades por SKU antes de crear. No borra
históricos, no repone stock y no sobrescribe precios MXN existentes. Si falta
MXN en un price set existente, lo añade conservando otras monedas.

Los precios son sintéticos de laboratorio: tarifa por 100 g, descuento por
volumen, redondeo a $5 y mínimo de $15. No son precios autorizados para venta.

## Inventario de laboratorio

- Apertura inicial: 50 unidades por variante oficial.
- `manage_inventory=true`, `allow_backorder=false`.
- Ubicación, canal, proveedor manual, fulfillment set y zona México enlazados.
- Reservas y carrito usan workflows nativos con locking PostgreSQL/Redis.
- `inventory:restore` es manual, requiere confirmación y bloquea por ubicación e
  inventory item antes de recalcular el absoluto.

## Search

El índice incluye `mxn`, `eur` y `usd`. El seed espera la ingesta de los
productos oficiales; si Search falla, deja el catálogo persistido y registra que
falta reindexar. Ver `docs/77-SEARCH-MXN-Y-SINCRONIZACION.md`.

## Runbook y límites

Ver `docs/90-CATALOGO-OFICIAL-MEXICO.md`. Pagos, envío, precios y stock siguen
siendo de laboratorio. No hay cobro, fulfillment, devolución ni reembolso real.
