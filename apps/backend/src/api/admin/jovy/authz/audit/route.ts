import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authzError, authzService } from "@jovy/lib/jovy/authz/http"

/** Últimos cambios de roles y asignaciones; sin secretos ni PII. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const requested = Number((req.query as Record<string, unknown>).limit)
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 200) : 50
    const logs = await authzService(req).listJovyAuthzAuditLogs(
      {},
      { take: limit, order: { created_at: "DESC" } },
    )
    res.json({ audit_logs: logs })
  } catch (error) {
    authzError(res, error)
  }
}
