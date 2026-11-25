# Promociones y operación de pedidos

**Corte:** 2026-11-24
**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO.
**Proveedor de pago:** `pp_system_default` (sin cobro real).
**Proveedor logístico:** envío manual de laboratorio.

## Promociones nativas

No se creó un gestor de descuentos en `jovy-marketing`. Se usó el Promotion
Module de Medusa. Las promociones de laboratorio se crean en la base descartable de la
suite y no se publican en la tienda real.

| Caso | Resultado |
|---|---|
| Cupón porcentual 10% sobre dos unidades de 10 000 | `discount_total = 2 000` |
| Retiro del cupón | `discount_total = 0` |
| Código inexistente | `400/422`, carrito sin descuento |
| Promoción marcada inactiva | Sin descuento; Medusa puede aceptar el código sin aplicarlo |
| Regla por producto | Solo el producto elegible recibe 20%; el otro no recibe descuento |

Campos usados:

```json
{
  "code": "DEMO10",
  "type": "standard",
  "status": "active",
  "application_method": {
    "type": "percentage",
    "target_type": "items",
    "allocation": "each",
    "max_quantity": 100,
    "value": 10,
    "currency_code": "mxn"
  }
}
```

`max_quantity` es obligatorio para `allocation=each` o `once` en Medusa
2.22.6. No se usa una lista de precios comercial ni se altera el precio base.

### Storefront

El checkout actual no muestra un campo de cupón. Esta campaña no inventó una
pantalla nueva ni duplicó la lógica de totales: los totales siempre los calcula
Medusa. La integración de UI queda como trabajo posterior a una decisión de
experiencia de compra.

## Ciclo de pedido

La prueba completa un carrito con:

1. Producto publicado y modalidad `SELLABLE`.
2. Envío manual creado en la base descartable.
3. Dirección de envío de México.
4. Payment Collection + Payment Session con `pp_system_default`.
5. `POST /store/carts/:id/complete`.

Resultado:

```text
type = "order"
order.status cambia a "canceled" tras POST /admin/orders/:id/cancel
GET /admin/orders/:id confirma el estado persistido
```

No se simula un reembolso. `pp_system_default` no captura dinero, por lo que no
existe un refund real que verificar. Tampoco se creó fulfillment ni se generó
guía: la logística real sigue bloqueada.

## Matriz de estados observada

| Dominio | Estado probado | Evidencia |
|---|---|---|
| Order | `pending` → `canceled` | Pedido completado y cancelado por Admin |
| Payment | Sesión de sistema | Sin captura real |
| Fulfillment | No iniciado | No se generó envío |
| Return | No probado | Requiere fulfillment real y política de devolución |
| Refund | No probado | Requiere proveedor de pago real |

No se resume el ciclo en un campo propio. Los estados nativos de Medusa siguen
siendo la fuente de verdad.

## Pendientes comerciales

- Seleccionar proveedor de pago y política de webhooks/reembolsos.
- Definir transportista, tarifas, cobertura y devoluciones.
- Probar cancelación después de fulfillment y después de captura real.
- Definir si el cupón se muestra en carrito, checkout o ambos.
- Aprobar campañas y límites de uso antes de publicar promociones reales.

## Pruebas

Suite `commerce-operations.spec.ts`:

- 4 casos de Promotion Module;
- 2 casos de Inventory Module;
- 1 caso de ciclo de pedido;
- 1 caso de readiness;
- 1 caso de bootstrap de publishable key.

Total de la suite: 9/9 PASS en base descartable.
