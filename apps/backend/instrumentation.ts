import { registerOtel } from "@medusajs/medusa"
import { ConsoleSpanExporter } from "@medusajs/framework/opentelemetry/sdk-trace-node"
import { MedusaError } from "@medusajs/framework/utils"

/**
 * Instrumentación OpenTelemetry opt-in.
 *
 * Medusa 2.22.6 ya trae `NodeSDK`, `sdk-trace-node` y la instrumentación de
 * PostgreSQL mediante `@medusajs/framework/opentelemetry/*`. No se añade un
 * exporter de red: el único disponible sin una dependencia nueva es el de
 * consola, útil para laboratorio. Staging/producción deben aprobar un exporter
 * OTLP y sustituirlo aquí; activar `OTEL_ENABLED=true` con otro exporter falla
 * de forma explícita.
 */
export function register() {
  if (process.env.OTEL_ENABLED !== "true") return

  const exporter = process.env.OTEL_TRACES_EXPORTER ?? "console"
  if (exporter !== "console") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "OTEL_TRACES_EXPORTER no soportado: solo 'console' está disponible sin añadir una dependencia aprobada.",
    )
  }

  registerOtel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "jovycandy-medusa",
    exporter: new ConsoleSpanExporter(),
    instrument: {
      http: true,
      workflows: true,
      query: true,
      db: true,
      cache: true,
    },
  })
}
