# Arquitectura ecommerce B2C JovyCandy 3.0

**Estado:** IMPLEMENTADO EN LABORATORIO. Sin despliegue ni pagos reales.

## Capas

```text
Next.js 16 (App Router)
├── Server Components
│   ├── catálogo + CMS /store/jovy/*
│   ├── ficha + Medusa Store API
│   ├── carrito/checkout/cuenta (shell)
│   └── confirmación con cookie firmada
├── Client islands
│   ├── CommerceProvider (carrito)
│   ├── CartDrawer
│   ├── selector de variante/cantidad
│   ├── checkout por pasos
│   └── cuenta B2C
└── Route Handlers /api
    ├── /api/cart
    ├── /api/checkout
    └── /api/account

Medusa 2.22.6
├── Product / Pricing / Inventory
├── Region / Sales Channel
├── Cart / Fulfillment / Payment
├── Order / Customer / Auth
└── Jovy CMS modules (editorial, catálogo, marketing)
```

## Propiedad de datos

- **Medusa:** producto comercial, variantes, precios, región, inventario, carrito, envío, pago, pedido, cliente y direcciones.
- **Jovy CMS:** familia, gramaje descriptivo, certificaciones, modalidad, novedad y contenido editorial.

No existe una tabla paralela de carritos ni pedidos. El BFF no guarda precios ni totales: los recalcula Medusa y los devuelve al cliente.

## BFF

- Carrito identificado por cookie `jovy_cart_id` HttpOnly.
- Cliente autenticado por cookie `jovy_customer_token` HttpOnly.
- Confirmación por cookie `jovy_last_order` firmada con HMAC y expiración de 10 minutos.
- Toda escritura valida mismo origen (`Origin`/`Sec-Fetch-Site`).
- Los tokens/cookies nunca se exponen al JavaScript del navegador.

## Decisiones

- No se agregó un SDK pesado: cliente fetch tipado y acotado en `lib/medusa`.
- No se implementó otro backend ni checkout por SQL.
- El carrito invitado se transfiere al cliente con `POST /store/carts/:id/customer`.
- El pago usa `pp_system_default` de Medusa.
- La región México/MXN y el envío de laboratorio se preparan con `seed:commerce`.

## Límites

- Pago y envío son de laboratorio.
- No hay proveedor de correo real.
- No hay recuperación de contraseña con enlace seguro.
- El BFF vive en el mismo Next.js; un despliegue multiinstancia requeriría almacenamiento compartido para rate limiting.
