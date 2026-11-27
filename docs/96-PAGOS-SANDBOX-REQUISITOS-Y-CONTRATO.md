# Stripe sandbox: configuración, contrato y validación

**Estado:** IMPLEMENTADO para laboratorio local. Prueba conectada del
proveedor oficial: correcta en sandbox. Checkout con webhook de punta a
punta: **PENDIENTE**. Sin webhooks remotos ni cobros reales.

## Contrato

- Medusa 2.22.6 ya incluye `@medusajs/medusa/payment-stripe`. La configuración
  registra el provider oficial (`id: stripe`, `pp_stripe_stripe`), no un módulo
  de pagos paralelo. `capture: false` separa autorización y captura.
- Medusa fija total, moneda, colección y sesión. Next.js solo compara la
  sesión MXN, su vínculo y el importe en unidades menores del intent con
  el total de Medusa. No envía importes a Stripe ni crea Payment Intents.
- Stripe.js `10.4.0` y React Stripe.js `7.1.0` montan Payment Element. Stripe
  decide si ofrece Link; tarjeta no requiere cuenta Link. Se usan métodos
  dinámicos y el storefront no presenta sesiones que anuncien métodos fuera
  de tarjeta/Link. No se utilizan Stripe Payment Links.
- El navegador puede pedir a Medusa completar el carrito después de
  Stripe.js o tras volver de autenticación. El retorno no confía en query
  params ni marca compras como exitosas. La confirmación muestra un pedido
  emitido por Medusa, que puede tener el pago autorizado sin capturar.
- Carritos de total cero no crean sesión Stripe. Si todavía hay una sesión
  Stripe vinculada por un cambio concurrente, la solicitud no se completa
  hasta actualizar el carrito. Sin configuración, los importes positivos
  no tienen fallback. `pp_system_default` queda para pruebas de laboratorio
  explícitas, no como opción del checkout Stripe.

## Activación manual, únicamente en sandbox local autorizado

1. En Stripe Dashboard, selecciona el **sandbox** de JovyCandy. Si allí
   puedes crear una configuración de métodos dedicada, deja habilitada tarjeta
   y Link y usa su ID `pmc_…`. Si el sandbox es exclusivo del laboratorio,
   también puedes usar su configuración predeterminada con esos métodos.
   No cambies la configuración predeterminada si otras integraciones la usan.
   Usa solo identidades y
   [tarjetas de prueba](https://docs.stripe.com/testing).
2. Prepara un PostgreSQL local **independiente**, con puerto explícito
   diferente de `5432` y `55432`. Verifica identidad del servidor y base antes
   de migrar/sembrar. No copies credenciales ni datos de desarrollo habitual.
3. En terminal privada ejecuta `stripe login`, selecciona el sandbox con
   `stripe switch` y reenvía eventos al Medusa local. Ajusta el puerto si
   corresponde. No uses `--live`, `--print-json` ni guardes la salida del CLI
   en logs compartidos. Usa una consola sin `STRIPE_API_KEY` heredada
   de otro perfil para que el listener use el sandbox seleccionado.

   ```powershell
   stripe listen --events payment_intent.amount_capturable_updated,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.requires_action,payment_intent.canceled --forward-to http://localhost:9000/hooks/payment/stripe_stripe
   ```

4. Variables, fuera de Git y sin copiar sus valores a tickets o chats:

   | Entorno local | Variable | Valor esperado |
   |---|---|---|
   | Backend y storefront | `DEPLOYMENT_ENV` | `development` |
   | Backend y storefront | `JOVY_STRIPE_SANDBOX_ENABLED` | `true`, solo cuando el laboratorio esté preparado |
   | Backend | `DATABASE_URL` | PostgreSQL loopback, puerto de laboratorio explícito, sin query params |
   | Backend | `STRIPE_API_KEY` | `sk_test_` o `rk_test_` con permisos del sandbox |
   | Backend | `STRIPE_WEBHOOK_SECRET` | Firma `whsec_` del listener de **esa** CLI |
   | Backend | `STRIPE_PAYMENT_METHOD_CONFIGURATION` | ID `pmc_` opcional de la configuración del sandbox |
   | Backend | `JOVY_STRIPE_SANDBOX_ALLOW_SHARED_DATABASE` | `true` solo si aceptas crear pedidos de prueba en la base de desarrollo; por defecto el sandbox exige base aislada |
   | Storefront | `MEDUSA_BACKEND_URL` | URL loopback del Medusa de laboratorio |
   | Storefront | `STRIPE_PUBLISHABLE_KEY` | `pk_test_` del mismo sandbox |
   | Storefront | `JOVY_COMMERCE_SECRET` | Secreto aleatorio único de al menos 32 caracteres para firmar la confirmación |

   La clave secreta y el webhook se leen solo en backend. No habilites
   `JOVY_MANUAL_CHECKOUT_FOR_E2E` con Stripe. No uses una clave de
   Stripe como `MEDUSA_PUBLISHABLE_API_KEY`: son credenciales distintas.
5. Con `DATABASE_URL` de laboratorio **ya verificada**, aplica migraciones y
   prepara la infraestructura comercial local. Usa únicamente un catálogo de
   prueba; si el laboratorio está vacío, el equipo debe cargar un catálogo
   sintético y validar inventario antes de intentar comprar.

   ```powershell
   pnpm --dir apps/backend exec medusa db:migrate
   pnpm --dir apps/backend seed:commerce
   pnpm dev
   ```

   Arranca ambos procesos con las variables del laboratorio. En
   **Medusa Admin → Settings → Regions**, verifica `México`/`MXN`; habilita
   `pp_stripe_stripe` y quita la asociación de `pp_system_default` de esa
   región de pruebas. No cambies otras regiones. Comprueba que el canal y la
   publishable key de Medusa sean los del laboratorio.
6. Compra con una tarjeta de prueba. En **Medusa Admin → Orders**, abre el
   pedido: identifica el pago autorizado; ejecuta captura y confirma el estado
   capturado. Cruza el identificador del intent `pi_…`, la colección/pago de
   Medusa, el pedido y el `evt_…` en Stripe (solo identificadores). Desde
   Medusa Admin, valida cancelar **antes** de captura y reembolsar total/parcial
   **después**. El provider 2.22.6 no reconcilia `charge.refunded` externo:
   no ejecutes reembolsos directamente desde Stripe Dashboard.

## Webhook nativo

`POST /hooks/payment/stripe_stripe` (sin prefijo `pp_`) usa cuerpo original
y firma. Medusa acusa recibo y agenda procesamiento; un HTTP `200` no
significa firma válida, pago capturado ni pedido completado. El provider
valida firma y antigüedad en el consumidor y usa el `session_id` del intent.
No reenviar cuerpos ni secretos a observabilidad. Stripe puede incluir un
`client_secret` antes de que la página retire los parámetros. Next.js excluye
el retorno de sus logs de desarrollo y responde `Referrer-Policy: no-referrer`.
Si en el futuro hay un proxy, excluye allí también las query strings.

Para un endpoint remoto **futuro y autorizado**, en Stripe Dashboard,
**Developers/Workbench → Webhooks**, agrega un destino HTTPS del sandbox
en la ruta nativa, elige los eventos anteriores y configura el secreto del
endpoint (distinto del de CLI). Sigue pendiente contar con TLS,
base independiente, custodia de secretos, observabilidad sin datos sensibles,
restauración probada, pruebas de humo y rollback. Esta implementación
rechaza staging y producción.

## Laboratorio actual

Base aislada `jovycandy_stripe_lab` en un PostgreSQL local en el puerto
`56943`, con sus migraciones aplicadas. Backend y storefront de desarrollo
están configurados contra ella y la región México/MXN usa únicamente
`pp_stripe_stripe`. El listener de Stripe reenvía
`/hooks/payment/stripe_stripe` al backend local.

Comprobado: un pedido de **$144.00 MXN** (producto más envío) quedó
**autorizado y capturado** con tarjeta de prueba; el intento aparece en Stripe
como `succeeded` en modo de prueba, el webhook firmado se entregó y existe
**un solo pedido** en Medusa. La captura se ejecutó con el workflow nativo
porque el usuario creado no tenía permisos de Admin; ya se le asignó el rol
superadministrador del laboratorio.

También comprobado: reenviar los eventos de autorización y captura no creó
otro pedido ni duplicó el importe capturado, y un reembolso total desde la API
Admin dejó el pago en `refunded`, el total del pedido en cero y un reembolso
`succeeded` en Stripe.

Pendiente para cerrar la aceptación: pagar en el navegador con una tarjeta que
exija 3DS y observar el desafío real de Stripe; la automatización del iframe
del Payment Element no pudo rellenarse desde el runner local.

## Evidencia y criterios pendientes

- Contrato offline: [matriz del incremento](97-MATRIZ-STRIPE-CHECKOUT-CUENTA.md).
  Fixtures firmadas llaman el provider instalado; no hablan con Stripe.
- Por validar con sandbox: tarjeta aceptada/rechazada, 3DS, Link elegible,
  reintento, recarga/retorno, entrega real de webhooks, firma inválida sin
  efectos, eventos duplicados, retrasados y fuera de orden, captura, cancelación
  y reembolso. Para reentrega usa un evento de un intento originado por
  Medusa. `stripe trigger` por sí solo no vincula un intento a Medusa.
- Un incidente con autorización incierta requiere consultar el pedido y,
  si no se resuelve, comparar Stripe y Medusa antes de volver a pagar.
- Para desactivar el laboratorio, deshabilita primero el checkout de Stripe,
  concilia los intentos aún abiertos desde Admin y luego desvincula el
  provider de la región de pruebas y detén el listener. No borres pedidos.
- Selección para sandbox no autoriza uso comercial: comisiones/MXN,
  liquidaciones, contracargos, conciliación, PCI, permisos operativos y plan de
  salida siguen sujetos a revisión de negocio, finanzas y seguridad
  ([plan de preproducción](95-PLAN-PREPRODUCCION-ECOMMERCE.md)).

Referencias: [provider oficial](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider/stripe),
[Link con Payment Element](https://docs.stripe.com/payments/link/add-link-elements-integration),
[Stripe CLI listen](https://docs.stripe.com/cli/listen), [firmas](https://docs.stripe.com/webhooks/signature).
