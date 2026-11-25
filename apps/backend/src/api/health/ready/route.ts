import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const AUTHENTICATE = false
export const CORS = false

/**
 * Readiness distinto de liveness: `/health` (core) solo confirma que el
 * proceso responde; `/health/ready` comprueba una operación real contra
 * PostgreSQL. Sin base de datos el proceso no puede atender comercio y debe
 * salir del balanceador, aunque siga vivo.
 *
 * Redis y storage no se consultan aquí: su activación es opt-in y sus
 * credenciales no deben exponerse en un health check. Cuando se habiliten en
 * staging, el chequeo se amplía con probes autorizados.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const startedAt = Date.now()

  try {
    const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as {
      raw: (statement: string) => Promise<unknown>
    }
    await knex.raw("select 1")

    res.status(200).json({
      status: "ready",
      checks: { database: "ok" },
      deployment_env: process.env.DEPLOYMENT_ENV ?? null,
      worker_mode: process.env.WORKER_MODE ?? "shared",
      duration_ms: Date.now() - startedAt,
    })
  } catch {
    res.status(503).json({
      status: "not_ready",
      checks: { database: "unavailable" },
      deployment_env: process.env.DEPLOYMENT_ENV ?? null,
      worker_mode: process.env.WORKER_MODE ?? "shared",
      duration_ms: Date.now() - startedAt,
    })
  }
}
