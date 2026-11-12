import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_BRAND_MODULE)
  const audit_logs = await service.listJovyBrandAuditLogs(
    { entity_type: "logo", entity_id: req.params.id },
    { order: { created_at: "ASC" } },
  )
  res.json({ audit_logs })
}
