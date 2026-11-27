# Cuentas de cliente B2C

**Estado:** IMPLEMENTADO. El alcance de pruebas está en [la matriz](97-MATRIZ-STRIPE-CHECKOUT-CUENTA.md).

## Rutas

- `/{locale}/cuenta`
- Login: `POST /api/account`
- Registro: `POST /api/account/register`
- Logout: `DELETE /api/account`
- Perfil: `PATCH /api/account` (`first_name`, `last_name`, `phone`).
- Direcciones: `POST /api/account/addresses`; `PATCH`/`DELETE /api/account/addresses/:id`.
- Pedidos: `GET /api/account/orders?offset=0` (páginas de 10),
  `GET /api/account/orders/:id` y `POST /api/account/orders/:id` para volver a comprar.
- Listas privadas: `GET`/`POST /api/account/lists`. Mutaciones `create`, `rename`,
  `delete`, `add`, `remove` y `move`.
- Notificaciones y consentimiento: `GET`/`POST /api/account/notices`.

## Autenticación

Se usan las APIs oficiales de Medusa:

1. `POST /auth/customer/emailpass/register`
2. `POST /store/customers`
3. `POST /auth/customer/emailpass`

El token de cliente se guarda en la cookie HttpOnly `jovy_customer_token`, con
`SameSite=Lax`, `Secure` en producción o HTTPS y expiración de 7 días. El
token no se entrega a JavaScript del navegador.

## Carrito y pedidos

- Al iniciar sesión o registrarse, el carrito invitado se transfiere con `POST /store/carts/:id/customer`.
- Los pedidos creados con la sesión del cliente aparecen en `/store/orders`.
- Tanto el listado como el detalle en BFF usan el listado autenticado de Medusa
  y filtran por ID cuando hace falta. El `GET` nativo directo por ID también
  requiere autenticación y ownership. Invitados usan la confirmación del
  carrito; nunca se consulta un pedido invitado por ID a través del BFF.
- Volver a comprar usa solo variantes actuales, verifica publicación, canal,
  precio y disponibilidad, y agrega al carrito nativo. Responde con unidades
  agregadas y artículos no disponibles o de resultado incierto. No copia
  precios históricos, códigos ni envío.
- Logout y cambio de identidad dejan de exponer el carrito/confirmación de
  la sesión anterior en ese navegador; no borran el carrito de la base.
  El carrito activo sigue siendo el de Medusa en la misma sesión. No hay
  recuperación de carritos del otro dispositivo.

## UI

La ruta existente preserva registro, login y logout. Muestra pedidos con
detalle y estado, acceso al carrito activo, listas, direcciones MX que se
pueden editar, eliminar o marcar como predeterminadas, perfil y notificaciones.
La dirección predeterminada aparece en checkout; el correo de acceso no es
editable. La página no es indexable.

### Datos adicionales

El módulo `jovyCustomerSpace` sigue el [patrón de wishlist de Medusa](https://docs.medusajs.com/resources/plugins/guides/wishlist)
con enlaces de lectura al cliente y la variante. Solo almacena IDs y nombres
de listas; la presentación y disponibilidad se consultan en Medusa. Hay
favoritos más hasta 12 listas personalizadas y hasta 100 variantes por lista.
No se comparte una lista ni se reserva stock. Se pueden quitar referencias
de productos ausentes.

El buzón registra `order.placed` y `order.canceled` de clientes con cuenta;
la clave tipo de evento/pedido evita duplicados. Muestra 20 avisos recientes
y permite marcarlos leídos. El opt-in comercial comienza apagado y guarda
fecha al activarse. No se envía correo, push ni mensaje comercial.
Un proveedor futuro debe consumir las preferencias antes de cualquier
envío comercial y tratar mensajes transaccionales como una finalidad distinta.

## Pendiente

- Recuperación de contraseña con proveedor de correo real.
- Verificación de email y políticas de contraseña más estrictas.
- Avisos por pago, reembolso y fulfillment; los estados ya disponibles se
  presentan en el historial de pedidos.
- Conciliación de mutaciones parciales si se pierde la red entre añadir al
  carrito y retirar de una lista. La interfaz no repite altas automáticamente.
