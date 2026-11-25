# Inventario, reservas y concurrencia

**Corte:** 2026-11-24
**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO. NO ACTIVADO COMERCIALMENTE.
**Autoridad de inventario:** sin decisión. Medusa es la única fuente en el
laboratorio; no se creó un sistema paralelo.

## Punto de partida real

Las variantes Jovy del catálogo usan:

```text
manage_inventory = false
allow_backorder = true
```

Por tanto, el catálogo actual no controla existencias. Las pruebas de esta
campaña usan productos, stock locations, inventory items y niveles nuevos en una
base descartable. No se modificó stock de productos existentes.

## Comportamiento comprobado

### 1. Stock insuficiente al agregar al carrito

Con una variante `manage_inventory=true`, `allow_backorder=false` y una unidad
disponible:

- agregar dos unidades responde `400 insufficient_inventory`;
- no se crea la línea del carrito.

La comprobación de disponibilidad al agregar es una validación temprana. No es
una reserva definitiva: dos carritos pueden agregar la misma unidad si ambos
consultan antes de que exista una reserva.

### 2. Reserva y concurrencia

La reserva es la operación que compromete stock. Se ejecutaron tres reservas
concurrentes de una unidad contra un inventory item con dos unidades:

```text
createReservationsWorkflow x 3 en paralelo
resultado: 2 fulfilled, 1 rejected
nivel final: reserved_quantity = 2, available_quantity = 0
```

El workflow oficial envuelve `createReservationItems` con el Locking Module por
`inventory_item_id`. Esto evita la sobreventa en el punto de reserva.

**Hallazgo importante:** llamar directamente
`inventoryModuleService.createReservationItems` en paralelo, sin el workflow,
permitió tres reservas sobre dos unidades. El servicio valida contra el nivel
que leyó, pero no coordina la sección crítica entre procesos. En producción no
se debe usar esa llamada directa para comprometer stock; se debe usar el
workflow oficial o una abstracción que aplique el mismo locking.

### 3. Backorder autorizado

Con `allow_backorder=true`, stock cero y una variante que lo permite, agregar
tres unidades responde `200` y conserva la cantidad solicitada. El backorder es
una decisión de catálogo, no un comportamiento automático del sistema.

## Decisión pendiente

Antes de activar inventario comercial hay que definir:

- Si Medusa es la autoridad o si un ERP/WMS lo es.
- Si se permite backorder por producto, familia o canal.
- Qué ocurre cuando una reserva queda huérfana.
- Cómo se reconcilia stock entre sistemas.
- Quién puede ajustar niveles y con qué auditoría.

No se debe activar `manage_inventory=true` en el catálogo real solo porque las
pruebas pasan. Hace falta la decisión anterior y una carga inicial validada.

## Contrato preparado para ERP/WMS

| Concepto | Identificador estable | Operación |
|---|---|---|
| Producto comercial | `product.id` | referencia, no autoridad de stock |
| Variante | `variant.id` / `sku` | unidad vendible |
| Inventory item | `inventory_item_id` | unidad de stock |
| Stock location | `location_id` | bodega o ubicación |
| Nivel | `inventory_item_id + location_id` | cantidad disponible |
| Reserva | `reservation.id` / `line_item_id` | compromiso temporal |
| Ajuste | movimiento con idempotency key | entrada, salida o corrección |

Reglas mínimas del futuro adaptador:

1. Toda mutación lleva una clave de idempotencia.
2. Un reintento no duplica reservas ni ajustes.
3. El sistema externo confirma antes de liberar una reserva.
4. Una caída se resuelve por reconciliación, no por borrado masivo.
5. Los errores distinguen stock insuficiente, ubicación inválida y fallo técnico.
6. La autoridad se declara explícitamente; no se escriben dos fuentes a la vez.

## Pruebas ejecutadas

| Escenario | Resultado |
|---|---|
| Producto con stock 1, agregar 2 | Rechazo controlado |
| Producto con backorder, stock 0, agregar 3 | Aceptado |
| Tres reservas concurrentes contra stock 2 | 2 aceptadas, 1 rechazada |
| Nivel final tras reservas | `reserved=2`, `available=0` |
| Producto `CATALOG_ONLY` | No se modificó; sigue fuera de compra |

Suite: `apps/backend/integration-tests/http/commerce-operations.spec.ts`.
Base descartable `medusa-jovy-http-commerce-operations`. Sin pagos ni stock
productivo.
