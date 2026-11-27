# Pagos sandbox: requisitos, contrato y staging

**Corte:** 2026-11-27
**Estado:** PROPUESTO. Ningún proveedor seleccionado ni instalado.
**Base:** `docs/95-PLAN-PREPRODUCCION-ECOMMERCE.md`.

## 1. Regla de decisión

No se elige Stripe, Mercado Pago, Openpay ni otro proveedor por defecto. La
selección requiere aprobación de negocio, finanzas y seguridad después de
completar la matriz de la sección 2.

La integración debe ser un **Payment Provider nativo de Medusa**. No se crea un
módulo paralelo de pagos, pedidos, conciliación o reembolsos.

## 2. Matriz de requisitos del proveedor

| Criterio | Pregunta obligatoria | Evidencia mínima |
|---|---|---|
| Disponibilidad en México | ¿Opera legal y técnicamente en México? | Contrato, cobertura y moneda MXN confirmados |
| Métodos requeridos | ¿Tarjeta, transferencia, efectivo, meses sin intereses u otros? | Lista aprobada por negocio |
| Comisiones y liquidaciones | ¿Comisión, IVA, plazo, moneda y retención? | Tarifario y calendario de liquidación |
| Compatibilidad Medusa 2 | ¿Tiene provider oficial o API compatible con Payment Module? | Versión soportada y método de integración |
| Sandbox | ¿Permite pruebas completas sin dinero real? | Credenciales sandbox y casos documentados |
| Webhooks firmados | ¿Firma, timestamp, reintentos y tolerancia? | Algoritmo, secreto y ejemplo verificable |
| Idempotencia | ¿Acepta claves idempotentes en cobro, captura y reembolso? | Documentación y prueba de reintento |
| Autorización y captura | ¿Autoriza y captura por separado? | Flujo y estados disponibles |
| Cancelaciones y reembolsos | ¿Total, parcial, antes y después de captura? | Reglas y límites |
| Conciliación | ¿Identificador único por transacción y liquidación? | Reporte o API de conciliación |
| Contracargos | ¿Notificación, plazos y evidencia? | Procedimiento y responsabilidades |
| Seguridad y credenciales | ¿PCI, secretos, rotación y logs? | Alcance PCI y política de llaves |
| Operación | ¿Soporte, SLA, mantenimiento y estado del servicio? | Contacto y ventana de soporte |
| Salida | ¿Cómo se revoca y migra sin perder conciliación? | Plan de rollback y exportación |

Cada fila debe quedar **Aprobada**, **Rechazada** o **Pendiente**. Una fila
bloqueante pendiente impide instalar el proveedor.

## 3. Contrato técnico con Medusa

### Registro del provider

El proveedor se registra como módulo nativo de pago:

```ts
{
  resolve: "@medusajs/medusa/payment",
  options: {
    providers: [
      {
        resolve: "./src/modules/payment-<provider>",
        id: "pp_<provider>",
        options: {
          sandbox: true,
          apiKey: process.env.PAYMENT_PROVIDER_API_KEY,
          webhookSecret: process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET,
        },
      },
    ],
  },
}
```

La región México debe incluir `pp_<provider>` en `payment_providers`. El checkout
sigue usando Payment Collection y Payment Session; no se llama al proveedor desde
Next.js.

### Interfaz mínima

El servicio extiende `AbstractPaymentProvider` de
`@medusajs/framework/utils` e implementa, como mínimo:

| Método | Responsabilidad |
|---|---|
| `getIdentifier()` / identifier | Identificador estable `pp_<provider>` |
| `initiatePayment` | Crear intención/sesión y devolver id + data |
| `updatePayment` | Actualizar monto o datos antes de autorizar |
| `authorizePayment` | Autorizar y devolver estado |
| `capturePayment` | Capturar total o parcial |
| `cancelPayment` | Cancelar autorización o sesión |
| `refundPayment` | Reembolsar total o parcial |
| `deletePayment` | Limpiar sesión no completada |
| `retrievePayment` | Reconsultar estado real |
| `getPaymentStatus` | Mapear estado del proveedor a Medusa |
| `getWebhookActionAndData` | Verificar firma y devolver acción |

Métodos opcionales de account holder y payment methods solo se implementan si
el negocio aprueba tokenización o cobros recurrentes.

### Datos persistidos

En `session.data` se guarda únicamente lo necesario:

```json
{
  "provider_payment_id": "...",
  "provider_status": "...",
  "idempotency_key": "...",
  "capture_mode": "manual|automatic",
  "amount": 0,
  "currency_code": "mxn"
}
```

No se guardan números de tarjeta, CVV, tokens completos ni secretos.

### Webhooks

Medusa expone `POST /hooks/payment/:provider`. El provider debe:

1. Verificar firma, timestamp y tolerancia.
2. Rechazar payload inválido sin cambiar estados.
3. Ser idempotente por id de evento del proveedor.
4. Mapear el evento a `authorized`, `captured`, `canceled`, `failed` o
   `pending`.
5. Devolver una acción compatible con el Payment Module.
6. No confiar en el monto enviado por el cliente; reconsultar al proveedor si
   hay duda.

La ruta de webhook debe ser pública por HTTPS en staging. No se usa la URL de
producción para pruebas.

### Flujo de estados

```text
Cart
  → Payment Collection
  → Payment Session (pending)
  → authorizePayment
  → captured o pending
  → complete cart
  → Order
  → refund/cancel según proveedor
```

La orden y el pago conservan estados nativos de Medusa. No se resume el ciclo en
un campo propio.

### Idempotencia y concurrencia

- Clave de idempotencia por intento de cobro y por reembolso.
- Reintento de red no duplica cobro ni reembolso.
- Webhook duplicado no duplica transición.
- Captura y cancelación concurrentes se resuelven con el estado real del
  proveedor.
- La conciliación usa el id de transacción del proveedor y el id de pago de
  Medusa.

## 4. Prerrequisitos de staging

No se despliega nada en este incremento. Para probar un proveedor con webhooks
se requiere:

| Requisito | Criterio |
|---|---|
| URL HTTPS backend | Dominio o túnel autorizado con TLS |
| URL HTTPS storefront | Checkout y retorno del proveedor |
| PostgreSQL independiente | Base staging, migraciones y backup |
| Secretos sandbox | Fuera de Git, por ambiente, rotables |
| Región y canal | México/MXN y canal de staging |
| Provider en región | `pp_<provider>` habilitado solo en staging |
| Endpoint webhook | `/hooks/payment/<provider>` accesible |
| Firma de webhook | Secreto sandbox y prueba de rechazo |
| Observabilidad | Request id, event id, payment id y order id |
| Backups | Restauración probada antes de cobrar |
| Smoke tests | Catálogo, carrito, pago, pedido y webhook |
| Rollback | Deshabilitar provider y volver a laboratorio |

## 5. Pruebas de aceptación sandbox

1. Pago aprobado autoriza y captura una sola vez.
2. Pago rechazado no crea pedido y conserva carrito.
3. Redirección/3DS, si aplica, vuelve al checkout correcto.
4. Webhook válido actualiza el pago.
5. Webhook con firma inválida se rechaza sin cambios.
6. Webhook duplicado no duplica estados.
7. Webhook fuera de orden no retrocede el estado.
8. Reembolso total y parcial actualizan pago y pedido.
9. Cancelación antes y después de captura queda auditada.
10. Conciliación cruza transacción, liquidación y pedido.
11. No aparecen datos de tarjeta ni secretos en logs.
12. El storefront muestra totales y estados calculados por Medusa.

## 6. Bloqueos de negocio

- Proveedor y contrato no aprobados.
- Métodos de pago y meses sin intereses no definidos.
- Política de reembolsos, contracargos y conciliación no aprobada.
- Credenciales sandbox y responsable de custodia no asignados.
- Staging con TLS y webhook público no disponible.
- Tratamiento fiscal de comisiones y CFDI no definido.
- Responsable operativo de disputas y soporte no designado.

## 7. Recomendación

Completar la matriz, aprobar un proveedor y ejecutar primero una integración
**sandbox** con autorización, captura, webhook firmado y reembolso. No se
instala ningún SDK ni provider hasta que la matriz esté aprobada.

Después de pagos, continuar con envíos, inventario, impuestos y operación según
`docs/95-PLAN-PREPRODUCCION-ECOMMERCE.md`.
