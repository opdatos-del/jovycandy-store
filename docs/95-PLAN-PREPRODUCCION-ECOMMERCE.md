# Plan de preproducción ecommerce

**Corte:** 2026-11-27
**Estado:** PROPUESTO. Sin proveedores seleccionados ni integraciones productivas.
**Alcance:** JovyCandy 3.0 sobre Medusa 2.22.6, storefront Next.js y PostgreSQL.

## 1. Punto de partida

| Área | Estado actual | Límite |
|---|---|---|
| Catálogo | Medusa Product Module | Estable |
| Precios y promociones | Pricing y Promotion nativos | Estable en laboratorio |
| Carrito y pedido | Store API + workflows nativos | Pago `pp_system_default` |
| Envío | Proveedor manual de laboratorio | Sin tarifas ni tracking reales |
| Inventario | Inventory Module con ubicación de laboratorio | Autoridad comercial sin decidir |
| Impuestos | Región fiscal MX con proveedor del sistema | Sin CFDI ni PAC |
| Correo | Sin proveedor transaccional | Sin notificaciones reales |
| Operación | Admin Medusa + RBAC Jovy | Sin runbook productivo |

Principios:

- Medusa sigue siendo la fuente de verdad comercial.
- No se crean tablas paralelas de pedidos, pagos, envíos o impuestos.
- Cada integración se implementa como adaptador de un módulo nativo.
- Toda mutación externa usa idempotencia y reconciliación.
- Ningún proveedor se selecciona sin aprobación de negocio.
- Producción, staging y bases protegidas no se usan para pruebas destructivas.

## 2. Pagos

### Capacidades nativas

- Payment Module, Payment Collection y Payment Session.
- Proveedores por región y modo captura automática o manual.
- Webhooks de proveedor, autorización, captura, cancelación y reembolso.
- Workflows de pedido, devolución y reembolso.
- Estados y totales calculados por Medusa.

### Decisiones de negocio

- Proveedor aprobado y país de operación.
- Métodos: tarjeta, transferencia, efectivo, meses sin intereses u otros.
- Captura automática o al confirmar fulfillment.
- Política de reembolsos totales y parciales.
- Conciliación contra estado de cuenta y liquidaciones.
- Responsable de disputas, contracargos y soporte.

### Dependencias

- Credenciales sandbox y producción fuera de Git.
- Cuenta mercantil, contrato y cumplimiento PCI aplicable.
- URL pública con TLS para webhooks.
- Ambiente staging con secretos separados.
- Definición fiscal de la venta.

### Pruebas de aceptación

1. Pago aprobado crea pedido y captura una sola vez.
2. Pago rechazado no crea pedido y conserva carrito.
3. Webhook duplicado o fuera de orden no duplica estados.
4. Reembolso total y parcial actualiza pedido y pago.
5. Cancelación antes y después de captura queda auditada.
6. Conciliación diaria detecta diferencias sin ajustes manuales silenciosos.
7. No se registran datos de tarjeta en logs ni en la base propia.

## 3. Envíos y fulfillment

### Capacidades nativas

- Fulfillment Module, fulfillment sets, service zones y shipping options.
- Proveedor manual y proveedores logísticos.
- Fulfillment, shipment, tracking y devoluciones.
- Reglas por país, zona, precio, peso o canal.

### Decisiones de negocio

- Transportistas y cobertura nacional o regional.
- Tarifas por zona, peso, volumen o monto.
- Envío gratis y umbrales.
- Tiempos de entrega, corte y días festivos.
- Seguro, paquetería de retorno y política de devoluciones.
- Responsable de incidencias y paquetes perdidos.

### Dependencias

- Cuentas y credenciales de transportista.
- Direcciones de origen, empaque y pesos reales.
- Zonas y tarifas aprobadas.
- Impuestos y datos fiscales del envío.

### Pruebas de aceptación

1. Cotización correcta por zona y peso.
2. Opción no disponible se oculta sin romper checkout.
3. Envío gratis solo aplica con opción válida.
4. Fulfillment genera guía y tracking.
5. Pedido enviado y entregado refleja estados nativos.
6. Devolución y reenvío conservan inventario y pago.
7. Cancelación antes de fulfillment libera reservas correctamente.

## 4. Inventario

### Capacidades nativas

- Inventory Module, stock locations, niveles y reservas.
- Workflows con locking para evitar sobreventa.
- Backorder por variante.
- Movimientos, ajustes y transferencias entre ubicaciones.
- Reservas ligadas a líneas de carrito y pedido.

### Decisión principal

Definir una sola autoridad:

- **Medusa:** simple, suficiente para operación pequeña.
- **ERP/WMS:** necesaria si compras, almacén y contabilidad ya viven allí.
- **Híbrido:** solo si se define dirección de sincronización y reconciliación.

No se escriben dos fuentes a la vez.

### Decisiones de negocio

- Autoridad de stock y dirección de sincronización.
- Unidad de venta, empaque y merma.
- Backorder permitido por producto, familia o canal.
- Stock de seguridad y asignación por ubicación.
- Frecuencia de sincronización y ventana de mantenimiento.
- Responsable de ajustes y auditoría.

### Dependencias

- API del ERP/WMS o decisión Medusa-only.
- Mapeo estable SKU ↔ inventory item ↔ ubicación.
- Claves de idempotencia para movimientos.
- Procedimiento de reconciliación y recuperación.

### Pruebas de aceptación

1. Reserva concurrente no sobrevende.
2. Venta descuenta stock una sola vez.
3. Reintento de movimiento no duplica cantidades.
4. Cancelación libera reserva.
5. Devolución reingresa stock según política.
6. Backorder respeta configuración.
7. Reconciliación explica diferencias sin borrado masivo.

## 5. Impuestos y CFDI

### Capacidades nativas

- Tax Module, regiones fiscales y cálculo por línea.
- Precios con o sin impuesto incluido.
- Proveedor de impuestos y tasas por país/región.
- Totales y ajustes calculados por Medusa.

### Decisiones de negocio

- Tratamiento de IVA y tasa aplicable.
- Precios con IVA incluido o desglosado.
- Emisión de CFDI: momento, serie, folio y régimen.
- Datos fiscales del cliente y validación de RFC.
- PAC, CSD, cancelaciones, notas de crédito y retenciones.
- Facturación de envíos, descuentos y promociones.

### Dependencias

- Asesoría fiscal y alta ante SAT.
- PAC aprobado y credenciales fuera de Git.
- Certificados CSD y ambiente de pruebas.
- Contrato pedido ↔ factura ↔ pago.

### Pruebas de aceptación

1. Cálculo de impuesto coincide con regla fiscal aprobada.
2. Pedido con descuento refleja base e impuesto correctos.
3. CFDI se emite una sola vez por pedido.
4. Cancelación de factura y nota de crédito quedan auditadas.
5. Reembolso no duplica ni omite CFDI.
6. Error del PAC no bloquea el pedido sin estado explícito.
7. Datos fiscales no se exponen en logs ni endpoints públicos.

## 6. Operación

### Capacidades nativas

- Customers, pedidos, fulfillment y devoluciones en Admin.
- Promotions, campaigns y Price Lists.
- Usuarios, RBAC nativo y RBAC Jovy.
- Health checks, logs y subscribers.
- Notificaciones por proveedor.

### Decisiones de negocio

- Proveedor de correo transaccional, dominio y plantillas.
- Correos obligatorios: confirmación, envío, entrega, cancelación, reembolso.
- Roles: operador de pedidos, marketing, catálogo, finanzas, soporte.
- Flujo de aprobación de campañas y límites de gasto.
- Retención de datos, backups y restauración.
- Alertas, métricas, on-call y runbook de incidentes.

### Dependencias

- Proveedor de correo y DNS/SPF/DKIM/DMARC.
- Staging con datos sintéticos.
- Responsables por rol y matriz de permisos.
- Herramientas de observabilidad aprobadas.

### Pruebas de aceptación

1. Correo transaccional llega y no duplica en reintentos.
2. Pedido pagado, enviado, cancelado y reembolsado notifica correctamente.
3. Rol sin permiso no accede a pedidos ni configuración.
4. Campaña requiere aprobación antes de activarse.
5. Health checks y alertas detectan caída de base o backend.
6. Backup y restauración se prueban en staging.
7. Runbook cubre caída de pago, correo, base y webhooks.

## 7. Ambiente de preproducción

Requisitos mínimos antes de conectar proveedores:

- PostgreSQL aislado y backup verificado.
- Backend y storefront en URLs staging con TLS.
- Secretos por ambiente fuera de Git.
- Publishable key de staging y Admin separado.
- Datos sintéticos, sin copiar producción.
- Migraciones aplicadas de forma reproducible.
- Smoke tests de catálogo, carrito, pedido y Admin.
- Plan de rollback y responsable operativo.

## 8. Ruta recomendada

1. **Pagos en sandbox** con un proveedor aprobado.
   Es la integración que desbloquea el flujo real de pedido, webhooks,
   conciliación y reembolsos; el resto puede seguir manual temporalmente.
2. **Envíos** con cobertura y tarifas aprobadas.
3. **Inventario**, después de decidir Medusa vs ERP/WMS.
4. **Impuestos y CFDI**, con asesoría fiscal y PAC.
5. **Operación**, correo, roles, aprobaciones y observabilidad.

Orden propuesto: pagos → envíos → inventario → impuestos → operación. Si el
negocio exige factura desde el primer pedido, impuestos debe adelantarse antes
de abrir tráfico real.

## 9. Decisiones abiertas

| Decisión | Responsable | Bloquea |
|---|---|---|
| Proveedor de pagos y sandbox | Negocio/Finanzas | Checkout real |
| Captura y reembolsos | Negocio/Finanzas | Conciliación |
| Transportistas y tarifas | Operaciones | Envío real |
| Autoridad de inventario | Operaciones/Tecnología | Stock comercial |
| Tratamiento fiscal y PAC | Fiscal/Legal | CFDI |
| Proveedor de correo | Operaciones | Notificaciones |
| Roles y aprobaciones | Dirección | Operación segura |
| Staging y responsables | Tecnología | Validación preproductiva |
