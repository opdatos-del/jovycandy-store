# Observabilidad Medusa

**Corte:** 2026-11-24
**Estado:** IMPLEMENTADO EN CÓDIGO; EXPORTER DE RED PREPARADO SIN DEPENDENCIA.

## Health checks

| Endpoint | Tipo | Comprobación |
|---|---|---|
| `GET /health` | liveness | El proceso HTTP responde (core de Medusa) |
| `GET /health/ready` | readiness | `select 1` contra PostgreSQL |

`/health/ready` devuelve `200` con `status: ready` cuando la base responde y
`503` con `status: not_ready` cuando falla. No imprime el error de conexión ni
credenciales. Incluye `deployment_env`, `worker_mode` y duración.

Readiness no consulta Redis ni S3 en esta campaña porque esos proveedores están
desactivados y sus credenciales no deben exponerse. Cuando se activen, se debe
ampliar el probe en staging con un cliente autorizado.

Prueba de integración HTTP: `/health/ready` responde `200` y
`checks.database = "ok"`.

## OpenTelemetry

`apps/backend/instrumentation.ts` deja de ser una plantilla comentada. Es
opt-in:

```dotenv
OTEL_ENABLED=true
OTEL_TRACES_EXPORTER=console
OTEL_SERVICE_NAME=jovycandy-medusa
```

Instrumenta:

- HTTP;
- workflows;
- Query Graph;
- PostgreSQL;
- cache.

Medusa 2.22.6 ya incluye `NodeSDK`, `sdk-trace-node` y la instrumentación de
PostgreSQL a través de `@medusajs/framework/opentelemetry/*`; no se añadió una
dependencia nueva.

Limitación: el único exporter disponible sin dependencia adicional es el de
consola. Para staging/producción se debe aprobar e instalar un exporter OTLP.
Mientras no exista, `OTEL_TRACES_EXPORTER` distinto de `console` falla de forma
explícita al arrancar; no se finge telemetría remota.

## Logging

El proyecto usa el logger de Medusa. Los eventos nuevos registran:

- entrega de revalidación: éxito, reintentos y fallo final;
- configuración incompleta de revalidación;
- observador de contenido sin event bus.

No se registran cuerpos editoriales, direcciones, correos completos ni secretos.
Los errores de red se registran por categoría, no por mensaje crudo del cliente.

## Alertas propuestas

| Señal | Umbral sugerido |
|---|---|
| HTTP 5xx | > 1% durante 5 min |
| Checkout fallido | > 2% de carritos completados durante 15 min |
| Error de pago | cualquier error del provider en 5 min |
| Error de inventario | `insufficient_inventory` anómalo o reservas huérfanas |
| Worker detenido | sin heartbeat o sin jobs procesados |
| Redis desconectado | fallo de conexión repetido |
| PostgreSQL desconectado | readiness `503` sostenido |
| Subida fallida | > 5% en 15 min |
| Latencia | p95 > objetivo acordado |
| Revalidación CMS | fallo repetido de entrega |

No se instaló Prometheus, Grafana, Sentry ni otro servicio externo. Las señales
quedan documentadas para que operaciones elija la plataforma autorizada.

## Pendientes

- Aprobar exporter OTLP y backend de trazas.
- Definir retención y muestreo.
- Añadir correlation ID de extremo a extremo entre storefront, Medusa y worker.
- Probar alertas contra staging real.
- Añadir probe de Redis cuando exista.
