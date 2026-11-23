# Seguridad comercial y pruebas

**Estado:** IMPLEMENTADO EN LABORATORIO. Revisión productiva pendiente.

## Controles

- Modalidad comercial validada en servidor en `addToCart`, `updateLineItem` y `completeCart`.
- Fail-closed: tabla editorial ausente, error de PostgreSQL, variante inexistente o resolución parcial rechazan la operación.
- `CATALOG_ONLY` no se agrega ni finaliza; no depende de ocultar botones.
- Precios, moneda, envío y total se recalculan en Medusa.
- Carrito y cliente usan cookies HttpOnly; no se guardan tokens en localStorage.
- Escrituras BFF validan mismo origen.
- Confirmación firmada con HMAC; sin ID de pedido adivinable.
- Páginas de carrito, checkout y cuenta con `noindex`.
- No se usan APIs administrativas desde el storefront.
- `JOVY_COMMERCE_SECRET` es obligatorio en producción.

## Pruebas ejecutadas

- Unitarias de modalidad: 23/23.
- Seed de catálogo: 3/3.
- E2E storefront: 9/9, incluyendo compra invitado, carrito persistente con edición/eliminación, CATALOG_ONLY, cuenta y móvil.
- Typecheck backend/storefront.
- Build storefront.
- Lint sin errores; warnings de `<img>` y hooks históricos.

## Evidencia de pedido

Los pedidos de laboratorio se crean con estado `pending`, moneda `mxn`, total calculado y `customer_id` cuando el cliente está autenticado. Se verificaron en la base Medusa y quedan visibles en Admin.

## Riesgos pendientes

- No hay rate limiting compartido en el BFF.
- No hay prueba de carga ni auditoría OWASP completa.
- Confirmación depende de cookie de 10 minutos; si se pierde, el pedido sigue existiendo en Medusa.
- La recuperación de contraseña no tiene correo real.
- Falta prueba de concurrencia multi-pestaña y de expiración de sesión.
