import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_CONTENT_MODULE } from "@jovy/modules/jovy-content"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const contentService = req.scope.resolve(JOVY_CONTENT_MODULE)
  const audit_logs = await contentService.listAuditLogs(
    {
      entity_type: "editorial_page",
      entity_id: req.params.id,
    },
    { order: { created_at: "ASC" } },
  )

  res.json({ audit_logs })
}
