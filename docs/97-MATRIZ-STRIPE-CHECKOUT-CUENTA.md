# Matriz de validación: Stripe, checkout y cuenta

**Base:** `feat/campaign-2-stabilization`, `8eb43db`. Se conserva `.gitignore`
local. La validación se hace sin bases protegidas ni entornos remotos.

| Carril | Evidencia / comando | Alcance |
|---|---|---|
| Stripe: contrato offline | `pnpm --dir apps/backend test:unit --runTestsByPath src/lib/jovy/__tests__/stripe-sandbox.test.ts` | Registro y rechazo de configuración live/no aislada; HMAC válido, inválido y vencido, acciones y MXN. Prueba el código del provider instalado; no llama a Stripe. |
| BFF de pago: contrato offline | `pnpm --filter storefront test:scripts` | Sin fallback manual por defecto; cruces de sesión, importe, moneda, método y modo. |
| Checkout/cliente: laboratorio | `pnpm --dir apps/storefront test:e2e:campaign` | PostgreSQL 18 efímero, invitado, campaña, recarga con datos conservados, retorno sin pedido, importe cero y cuenta en móvil. Pago manual explícito, nunca Stripe. |
| Backend: integración | `pnpm --dir apps/backend test:integration:http:ephemeral integration-tests/http/commerce-operations.spec.ts` y `pnpm --dir apps/backend test:integration:modules:ephemeral src/modules/jovy-product-editorial/__tests__/product-editorial.integration.test.ts` | El launcher exige una ruta de suite explícita por ejecución. |
| Stripe: prueba conectada del proveedor | **7 comprobaciones correctas** | Intent de MXN 100.00 con tarjeta/Link habilitados, misma sesión al repetir la clave de idempotencia, autorización, captura, reembolso total verificado, rechazo de tarjeta y cancelación. Se instanció el proveedor oficial y se usaron métodos de prueba por API; no pasó por PostgreSQL, navegador, Admin ni receptor HTTP. |
| Stripe: checkout conectado de punta a punta | **Parcial: falta 3DS visual** | Confirmado con la API del BFF: sesión Stripe, autorización, un solo pedido Medusa, webhook firmado entregado, captura nativa, reenvío sin duplicados y reembolso total conciliado con Stripe. Falta observar un desafío 3DS en navegador. Detalle: [laboratorio actual](96-PAGOS-SANDBOX-REQUISITOS-Y-CONTRATO.md#laboratorio-actual). |

Unitarias: **54 suites / 494 pruebas**, incluidas **21** de Stripe offline.
Scripts de storefront: **9/9**. Launcher aislado: **12/12**.
Integración HTTP comercial: **20/20** (ejecución
`dfd248b7-7a32-4814-8690-9bc9aebdf541`). Integración de módulo editorial:
**5/5** (ejecución `455593d0-df4f-462c-be15-df98ab523bf1`). Ambos clusters
efímeros se detuvieron y limpiaron.

Playwright aislado: **13/13**, escritorio y cuenta móvil de 390 px
(`f482f596-a3bd-46c1-970e-3cd9956c116d`): `playwright: passed`, `cleanup: passed`,
`overall: passed`, `rootRemoved: true`. La cuenta cubre reutilización de
dirección, pedido propio, volver a comprar, deduplicación y traslado de
variantes, aviso real, lectura, consentimiento y rechazos entre dos clientes.
No se ejecutó la suite general de storefront contra la base habitual.

Navegador real con la extensión browse (sin Playwright): producto, alta al
carrito, cantidades 2→3→2 con importes correctos, checkout, envío estándar,
Payment Element de Stripe con **189,00 MXN**, pago con tarjeta de prueba y
**pedido #6 confirmado** en el navegador. Stripe quedó en `requires_capture`;
la captura desde la API Admin dejó el pedido en `captured`. Los webhooks
`amount_capturable_updated` y `succeeded` se entregaron con `200`.

Durante esa prueba se corrigió un defecto real del formulario: se desmontaba
el Payment Element antes de que `confirmPayment` resolviera, lo que impedía
confirmar la tarjeta. Ahora el elemento permanece montado hasta que Stripe
responde.


Typecheck y build de ambos paquetes: correctos. Lint: 0 errores, advertencias
preexistentes (41 backend, 30 storefront). `git diff --check`: correcto.

No deducir resultado de webhooks de un HTTP `200`. Registrar estado final
en Admin, el vínculo al pedido y los identificadores técnicos, sin secretos.
Para validar duplicados y eventos fuera de orden, reentregar eventos del
**mismo** pago creado por Medusa y comprobar que no cambia a un estado
anterior ni aparecen pedidos/capturas duplicados.

No ejecutar `next build` a la vez que `test:e2e:campaign`: la limpieza de
`.next` del build puede interferir con el directorio de la campaña.

## Migración

`jovyCustomerSpace/Migration20261127190000`: cuatro tablas nuevas para listas,
elementos, avisos y consentimiento; sin cambios en `Customer`, `Cart`, `Order`,
productos o precios. Índices parciales impiden duplicar favorito, variante
por lista, aviso por evento y preferencia por cliente. Los enlaces de lectura
no agregan tablas. Ejecutar contra laboratorio; no hay backfill ni copia de
datos históricos. Para rollback en una base con datos de usuario, volver a la
versión de aplicación anterior sin ejecutar `down`: `down` elimina solo las
cuatro tablas nuevas, con sus datos; requiere autorización aparte.
