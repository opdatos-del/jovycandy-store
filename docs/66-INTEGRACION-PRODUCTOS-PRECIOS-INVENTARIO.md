# Productos, precios e inventario

**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO LOCAL.
**Fuente comercial:** productos publicados en Medusa. El manifiesto histórico
vive en `apps/backend/src/scripts/migrations/jovycandy-legacy/manifest.json`
solo para reproducir la migración inicial.

## Fuente

- Catálogo: `/store/jovy/products` devuelve los productos publicados del canal y
  les superpone la ficha editorial cuando existe. Un producto creado en Admin
  aparece aunque no tenga ficha.
- Comercial: `/store/products?region_id=...` (Medusa Store API).
- Región: México (`mxn`), creada/reparada por `seed:commerce`.
- Precio: `variants.calculated_price.calculated_amount` y
  `original_amount`; `price_list_type = "sale"` activa el precio de oferta.
- Categorías y colecciones: Product Module nativo de Medusa.
- Inventario: Medusa Inventory Module, ubicación `Jovy México Laboratorio`.

## Mapper

`src/lib/medusa/store.ts` proyecta:

- `id`, `external_id`, `handle`, título, descripción y miniatura;
- imágenes y especificaciones (`jovy_specs` o referencia histórica de solo lectura);
- variantes con id, SKU, `weight` de Medusa, precio calculado, precio original,
  indicador de oferta y moneda;
- categorías y colección nativas;
- `manage_inventory`, `allow_backorder` e `inventory_quantity`;
- metadata visual de tarjetas.

El catálogo usa el precio mínimo y lo marca como “Desde” cuando hay varias
presentaciones con precio. La ficha usa el precio de la variante seleccionada.
Cuando una Price List `sale` está vigente se muestra el precio actual y el
original tachado; al expirar, Medusa vuelve al precio base.

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

## Importaci?n hist?rica

```powershell
$env:LEGACY_IMPORT_MODE="preview"
pnpm --dir apps/backend run import:legacy

$env:LEGACY_IMPORT_MODE="apply"
pnpm --dir apps/backend run import:legacy
```

Crea hasta 35 productos y 61 variantes en una instalación limpia. Es aditivo,
serializado con el Locking Module y resuelve identidades por SKU antes de crear.
Solo crea productos ausentes: no actualiza productos existentes, no repone stock
y no recalcula precios. Un producto editado en Admin conserva sus cambios.

Los precios sintéticos del manifiesto son datos exclusivos de laboratorio:
tarifa por 100 g, descuento por volumen, redondeo a $5 y mínimo de $15. No son
precios autorizados para venta y no se aplican a productos ya existentes.

## Inventario de laboratorio

- Apertura inicial: 50 unidades por variante importada en una base limpia.
- `manage_inventory=true`, `allow_backorder=false`.
- Ubicación, canal, proveedor manual, fulfillment set y zona México enlazados.
- Reservas y carrito usan workflows nativos con locking PostgreSQL/Redis.
- `inventory:restore` es manual, requiere confirmación y bloquea por ubicación e
  inventory item antes de recalcular el absoluto.

## Search

El índice incluye `mxn`, `eur` y `usd`. La importación solicita la ingesta de los
productos creados; si Search falla, deja el catálogo persistido y registra que
falta reindexar. Ver `docs/77-SEARCH-MXN-Y-SINCRONIZACION.md`.

## Runbook y límites

Ver `docs/90-MIGRACION-CATALOGO-LEGACY.md`. Pagos, envío, precios y stock siguen
siendo de laboratorio. No hay cobro, fulfillment, devolución ni reembolso real.
