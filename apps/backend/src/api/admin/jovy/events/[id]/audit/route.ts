import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_EVENTS_MODULE)
  const audit_logs = await service.listJovyEventAuditLogs({ entity_id: req.params.id }, { order: { created_at: "ASC" } })
  res.json({ audit_logs })
}
