# Cuentas de cliente B2C

**Estado:** IMPLEMENTADO Y PROBADO EN LABORATORIO.

## Rutas

- `/{locale}/cuenta`
- Login: `POST /api/account`
- Registro: `POST /api/account/register`
- Logout: `DELETE /api/account`
- Direcciones: `POST /api/account/addresses`
- Pedidos: `GET /api/account/orders`

## Autenticación

Se usan las APIs oficiales de Medusa:

1. `POST /auth/customer/emailpass/register`
2. `POST /store/customers`
3. `POST /auth/customer/emailpass`

El token de cliente se guarda en la cookie HttpOnly `jovy_customer_token`, con `SameSite=Lax`, `Secure` en producción y expiración de 7 días. Nunca se expone al cliente.

## Carrito y pedidos

- Al iniciar sesión o registrarse, el carrito invitado se transfiere con `POST /store/carts/:id/customer`.
- Los pedidos creados con la sesión del cliente aparecen en `/store/orders`.
- Un cliente no puede consultar pedidos de otro: la autorización la aplica Medusa con el token.
- Logout elimina la cookie de cliente; no elimina el carrito.

## UI

La página de cuenta incluye:

- login y registro;
- perfil/email;
- direcciones guardadas;
- alta de dirección MX;
- historial de pedidos;
- logout.

## Pendiente

- Recuperación de contraseña con proveedor de correo real.
- Edición y borrado de direcciones y dirección predeterminada.
- Verificación de email y políticas de contraseña más estrictas.
- Transferencia de carrito entre clientes y conflictos avanzados.
