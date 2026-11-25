# Decisiones comerciales pendientes

**Corte:** 2026-11-24
**Estado:** PREPARADO / BLOQUEADO para decisiones de negocio; varios frentes
técnicos ya están implementados en laboratorio.
**Avance de la segunda campaña:** Search MXN, pruebas de inventario/promociones/
pedido, revalidación CMS y readiness están implementados. Redis, S3, pagos,
logística, fiscalidad y staging siguen bloqueados por decisión o infraestructura.

## Matriz

| Decisión | Información requerida | Alternativas | Recomendación técnica | Impacto mientras falta | Trabajo seguro continuable |
|---|---|---|---|---|---|
| Pagos | Proveedor, contrato, credenciales sandbox, política webhook/reembolso | Stripe, Mercado Pago, Conekta u otro aprobado | Elegir uno y verificar soporte Medusa 2.22.6; mantener `pp_system_default` hasta entonces | No hay cobro real ni conciliación | Contratos, pruebas de fallos y webhooks sin proveedor activo |
| Logística | Carrier, tarifas, cobertura, SLA, devoluciones | Paquetería por definir | Mantener shipping manual DEMO separado de tarifas reales | No hay guías, tracking ni tarifas comerciales | Modelo de zonas y pruebas de disponibilidad |
| Fiscal/CFDI | Tratamiento IVA, catálogo, razón social, RFC, PAC, cancelaciones | PAC autorizado | No asumir tasa ni clasificación fiscal | No se puede facturar comercialmente | Documentar contrato pedido-factura y validaciones |
| Precios | Lista MXN aprobada, vigencia, canal y segmento | Price lists Medusa | Sustituir datos DEMO solo mediante importación validada | Precios de laboratorio no son autorizados | Search MXN y eventos implementados; falta política de vigencia |
| Inventario | Medusa, ERP o WMS como autoridad; reservas y conflictos | Medusa-only, ERP/WMS integrado | Definir una sola autoridad y contrato de caída/reconciliación | Variantes Jovy no gestionan stock | Reservas y concurrencia probadas; activación comercial pendiente |
| Correo | Proveedor, dominio, sandbox, SPF/DKIM/DMARC | SendGrid, Resend u otro aprobado | Activar un único provider sandbox tras aprobación | Sin notificaciones transaccionales reales | Plantillas, idempotencia y registro de fallos |
| Storage | S3/R2/MinIO, bucket, CDN, CORS, retención y backup | S3-compatible aprobado | Usar perfil opt-in `file-s3`; conservar `file-local` | Medios no son persistentes para staging | Inventario/hash/referencias y plan reversible |
| Hosting | Medusa Cloud o self-hosted; responsables y presupuesto | Una opción aprobada | No montar dos topologías productivas | No hay staging desplegado | Configuración por entorno y pipeline sin deploy |
| B2B | Compra directa/cotización, catálogo/precios y cuentas | Canal futuro Medusa | No crear canal definitivo sin reglas | Solo B2C laboratorio | Criterios de separación por canal |

## Datos necesarios antes de activación

Para cualquier proveedor externo, la aprobación debe incluir responsable,
entorno (sandbox/staging/producción), titularidad, secreto almacenado fuera de
Git, endpoint, límites de gasto, política de soporte, retención y procedimiento
de revocación. Para pagos, fulfillment, correo y storage se requiere además un
plan de prueba sin clientes ni datos productivos.

## Dependencias de staging

Staging permanece bloqueado hasta disponer de PostgreSQL aislado, Redis aislado
si se habilita, bucket aislado si se habilita, TLS/proxy, DNS o host autorizado,
secretos por ambiente, backup y acceso de operación. La infraestructura se
considera preparada en código, no desplegada.

## Reglas de operación

- `pp_system_default`, envío manual y precios DEMO solo sirven para laboratorio.
- Las pruebas de promociones, inventario y pedidos usan bases descartables; no
  autorizan promociones, stock ni pedidos reales.
- La revalidación CMS puede activarse por entorno con secreto compartido; no
  sustituye una decisión de contenido ni publica datos privados.
- Una publishable API key identifica un canal; no concede permisos administrativos.
- No instalar varios proveedores de pago, correo o logística para "probar" sin
  decisión comercial.
- No eliminar datos históricos, archivos locales ni configuración existente
  como condición de esta campaña.

## Próxima aprobación mínima

1. Elegir topología de staging y responsable operativo.
2. Autorizar Redis y/o storage S3-compatible aislados, o mantener perfiles
   locales explícitamente.
3. Aprobar autoridad de inventario y fuente de precios MXN.
4. Seleccionar pago, logística, fiscalidad y correo por separado; cada selección
   habilita una integración acotada y pruebas sandbox.
