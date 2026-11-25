import "server-only"

/**
 * Configuración de servidor para hablar con Medusa. En staging se inyecta en
 * runtime; las variables `NEXT_PUBLIC_*` quedan solo como compatibilidad local.
 */
export const MEDUSA_BACKEND_URL = (
  process.env.MEDUSA_BACKEND_URL ??
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  "http://localhost:9000"
).replace(/\/$/, "")

export const MEDUSA_PUBLISHABLE_API_KEY =
  process.env.MEDUSA_PUBLISHABLE_API_KEY ??
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY ??
  ""
