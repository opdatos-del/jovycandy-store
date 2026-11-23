# Carrito Medusa

**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO.

## Superficies

- Header: botón de carrito con contador.
- Drawer lateral accesible con `<dialog>`.
- Página `/{locale}/carrito`.
- Checkout `/{locale}/checkout`.

## BFF

| Método | Ruta | Acción |
|---|---|---|
| GET | `/api/cart` | recupera el carrito desde Medusa |
| POST | `/api/cart` | crea carrito en región MX |
| POST | `/api/cart/items` | agrega variante/cantidad |
| PATCH | `/api/cart/items/:id` | actualiza cantidad |
| DELETE | `/api/cart/items/:id` | elimina línea |

El carrito se identifica con la cookie HttpOnly `jovy_cart_id`. Al iniciar sesión o registrarse, el carrito invitado se transfiere al cliente con el endpoint oficial de Medusa.

## Reglas

- La UI nunca calcula precios finales; usa `subtotal`, `shipping_total`, `tax_total`, `discount_total` y `total` de Medusa.
- El carrito completado no se reutiliza; se crea uno nuevo al volver a comprar.
- Se bloquean dobles clics y mutaciones simultáneas con estado `mutating`.
- `CATALOG_ONLY` se rechaza en el hook de servidor.
- El drawer conserva foco, cierre por Escape/backdrop y restauración de foco.

## Persistencia

La cookie conserva solo el identificador del carrito. El estado se reconstruye desde Medusa al recargar; no se confía en precios de localStorage.

## Pendiente

- Pruebas de concurrencia con dos pestañas.
- Limpieza programada de carritos abandonados.
- Rate limiting compartido si se despliega en varias instancias.
