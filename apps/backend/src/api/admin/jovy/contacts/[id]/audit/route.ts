import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"
import { assertContactRecordAccess } from "@jovy/lib/jovy/authz/contacts"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const [contact] = await service.listJovyContactRequests(
    { id: req.params.id },
    { withDeleted: true },
  )
  if (!contact) return res.status(404).json({ message: "Solicitud no encontrada" })
  if (!assertContactRecordAccess(req, res, contact.contact_type, "read")) return

  const audit_logs = await service.listJovyContactAuditLogs(
    { contact_request_id: req.params.id },
    { order: { created_at: "ASC" } },
  )
  res.json({ audit_logs })
}
