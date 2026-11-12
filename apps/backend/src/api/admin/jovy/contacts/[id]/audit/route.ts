import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const audit_logs = await service.listJovyContactAuditLogs(
    { contact_request_id: req.params.id },
    { order: { created_at: "ASC" } },
  )
  res.json({ audit_logs })
}
