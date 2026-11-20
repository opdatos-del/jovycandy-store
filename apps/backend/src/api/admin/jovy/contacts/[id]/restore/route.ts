import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"
import { restoreContactWorkflow } from "@jovy/workflows/jovy-contacts/contact"
import { assertContactRecordAccess } from "@jovy/lib/jovy/authz/contacts"

/**
 * Restores a soft-deleted request. The lookup reads with `withDeleted` because
 * the default module filter hides exactly the rows this route targets.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const [contact] = await service.listJovyContactRequests({ id: req.params.id }, { withDeleted: true })
  if (!contact) return res.status(404).json({ message: "Solicitud no encontrada" })
  if (!assertContactRecordAccess(req, res, contact.contact_type, "restore")) return

  // The workflow is idempotent: a live request comes back unchanged and writes no audit.
  const { result } = await restoreContactWorkflow(req.scope).run({
    input: { id: contact.id, actor_id: getAdminActorId(req) },
  })
  res.json({ contact: result })
}
