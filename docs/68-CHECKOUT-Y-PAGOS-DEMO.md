# Checkout y pagos de laboratorio

**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO. No realiza cobros reales.

## Flujo

```text
Carrito
  → datos de contacto y dirección MX
  → opciones de envío de laboratorio
  → pago manual pp_system_default
  → revisión
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

Se validan correo, nombre, apellidos, dirección, ciudad, estado y código postal de 5 dígitos. El país se fija a México (`mx`) en esta campaña.

## Confirmación

Al completar el carrito:

- Medusa crea la orden real;
- el BFF guarda un resumen firmado en cookie HttpOnly `jovy_last_order`;
- la cookie expira en 10 minutos;
- la confirmación no usa un ID adivinable en la URL;
- el carrito se elimina de la cookie.

## Seguridad

- El precio, envío y total provienen de Medusa.
- No se aceptan IDs de variante, precios o totales confiados del cliente.
- El pago manual se identifica explícitamente como.
- La finalización exige envío seleccionado y carrito no vacío.
- El hook de finalización valida la modalidad de todas las líneas.

## Pendiente productivo

- Proveedor real (Mercado Pago, Conekta o Stripe) con webhooks y firma.
- Paqueterías y tarifas reales.
- Impuestos y CFDI.
- Recuperación de checkout interrumpido y conciliación de pagos.
