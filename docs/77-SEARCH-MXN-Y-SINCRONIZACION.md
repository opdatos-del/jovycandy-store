# Search MXN y sincronización del índice

**Corte:** 2026-11-24
**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO.
**Alcance:** índice de producto en PostgreSQL Search de Medusa 2.22.6.

## Cambio aplicado

`apps/backend/src/search/helpers/pricing.ts` declara ahora:

```ts
export const PRICE_CURRENCIES = ["mxn", "eur", "usd"] as const
```

Cada moneda genera cuatro campos con el mismo contrato:

| Campo | Uso |
|---|---|
| `min_price_<moneda>` | filtro, orden y faceta de precio mínimo |
| `max_price_<moneda>` | filtro, orden y faceta de precio máximo |
| `original_price_<moneda>` | precio anterior de la variante más barata |
| `on_sale_<moneda>` | faceta booleana de descuento |

MXN queda primero porque es la moneda comercial de México. EUR y USD se
conservan para datos históricos y no se eliminan.

`loadPricing` ejecuta una lectura de Query Graph por moneda, con
`calculated_price` en el contexto de esa moneda. No hay una lectura por
producto: el costo depende del número de monedas, no del tamaño del catálogo.

## Sincronización verificada en Medusa 2.22.6

Los comentarios anteriores del índice decían que varios workflows no emitían
eventos. La inspección del paquete instalado mostró lo contrario:

| Cambio | Evento real |
|---|---|
| Crear/actualizar/borrar Price List | `price-list.created`, `price-list.updated`, `price-list.deleted` |
| Agregar/quitar/actualizar precios de una Price List | `price-list.prices_added`, `price-list.prices_updated`, `price-list.prices_removed` |
| Asociar productos a un canal | `product.updated` con los IDs de producto |
| Asociar productos a una categoría | `product.updated` con los IDs de producto |
| Actualizar precios de variante | `product-variant.updated` con los IDs de variante |

Los eventos de Price List existen desde 2.21.3 y se añadieron a
`PRODUCT_EVENTS`. `resolveProductIds` resuelve una Price List mediante
`prices.price_set.variant.product_id`; una variante se resuelve por
`product_id`, y una categoría o canal por su relación existente.

## Limitación conocida

Una Price List que cruza `starts_at` o `ends_at` cambia el precio calculado sin
emitir un evento en ese instante. El documento del índice conserva el precio de
su última escritura hasta que otro cambio lo reindexe.

No se implementó una reindexación periódica ciega: recorrer el catálogo cada
poco tiempo sin una política comercial aprobada agrega carga y puede publicar
precios de una lista que negocio todavía no autorizó. Antes de staging se debe
elegir una de estas opciones:

1. Reindexación programada al inicio y fin de vigencia de cada lista.
2. Job que detecte listas que cruzaron una fecha y reindexe solo sus productos.
3. Reindexación manual documentada antes de una campaña.

Mientras no exista esa política, el índice es correcto para cambios por evento,
pero puede quedar desfasado por el simple paso del tiempo.

## Procedimiento de migración y reindexación

El índice se versiona y se reindexa al arrancar cuando cambia el esquema. La
evidencia de laboratorio mostró:

```text
[Search] Seeding 1 index(es): product (schema_changed)
[Search] Seeding "product" (schema_changed) into "product_v1"
[Search] Making "product" version 1 active
[Search] Seeded "product": 0 documents in 0s
```

Comando oficial para una base aislada:

```powershell
pnpm --dir apps/backend exec medusa db:migrate:search
```

Reglas:

- Ejecutar primero contra una base descartable o staging autorizado.
- No borrar índices activos ni usar opciones destructivas sin revisión.
- Verificar creación de la versión nueva, activación, consulta y reejecución
  idempotente.
- No reindexar la base de desarrollo compartida durante una demostración.

## Pruebas

| Prueba | Resultado |
|---|---|
| `PRICE_CURRENCIES` y campos MXN/EUR/USD | PASS |
| Mínimo, máximo y descuento por moneda | PASS |
| Moneda sin precio no escribe campos | PASS |
| Una lectura de grafo por moneda, incluida MXN | PASS |
| Resolución de producto desde Price List | PASS |
| Resolución de variante con borrado lógico | PASS |
| Resolución de canal mediante el propio índice | PASS |
| Migración de esquema de Search en suite HTTP | PASS |

Los tests unitarios del índice viven en
`apps/backend/src/lib/jovy/__tests__/search-*.test.ts`, fuera de
`apps/backend/src/search/`, porque el cargador de índices importa los archivos
de ese directorio al arrancar la aplicación.

## Seguridad de visibilidad

El endpoint `/store/search` sigue aplicando `status = published` y el filtro de
`sales_channel_ids` de la publishable API key. El índice no se usa para exponer
productos de otro canal. La comprobación de aislamiento por dos publishable keys
queda cubierta por la matriz de integración HTTP existente; no se relajó ningún
filtro para agregar MXN.
