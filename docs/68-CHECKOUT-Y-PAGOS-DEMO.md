# Checkout: laboratorio y Stripe sandbox

**Estado:** checkout nativo; Stripe conectado **PENDIENTE**. No realiza cobros reales.

## Flujo

```text
Carrito
  → invitado o cliente autenticado; contacto y dirección MX
  → selección de envío de Medusa
  → promociones y revisión de totales de Medusa
  → Payment Element (Stripe habilitado) o sin pago si el total es cero
  → completeCartWorkflow
  → orden Medusa
  → confirmación firmada
```

## Región y envío

`seed:commerce` prepara:

- región México con moneda MXN;
- región fiscal `mx`;
- fulfillment set de México;
- envío estándar (99 MXN) y express (149 MXN);
- proveedor de pago `pp_system_default`.

## Dirección

Se validan correo, nombre, apellidos, dirección, ciudad, estado y código postal de 5 dígitos. El país se fija a México (`mx`). Clientes pueden seleccionar sus direcciones MX; la predeterminada se precarga. Si el carrito ya tiene dirección, al recargar se restauran los datos guardados en Medusa.

## Confirmación

Al completar el carrito:

- Medusa crea la orden real;
- el BFF guarda un resumen firmado en cookie HttpOnly `jovy_last_order`;
- la cookie expira en 10 minutos;
- ni la confirmación ni `/checkout/retorno` buscan pedidos por ID de URL;
- el carrito se elimina de la cookie.

## Seguridad

- El precio, envío y total provienen de Medusa.
- No se aceptan IDs de variante, precios o totales confiados del cliente.
- El pago manual se identifica como de prueba y exige `JOVY_MANUAL_CHECKOUT_FOR_E2E=true` en el storefront. El runner de campaña configura ese flag; no se usa en el sandbox Stripe.
- La finalización exige envío seleccionado y carrito no vacío.
- El hook de finalización valida la modalidad de todas las líneas.

## Pendiente productivo

- Validación conectada del [sandbox Stripe y su webhook](96-PAGOS-SANDBOX-REQUISITOS-Y-CONTRATO.md).
- Paqueterías y tarifas reales.
- Impuestos y CFDI.
- Validación de recuperación de checkout interrumpido y conciliación con Stripe.
