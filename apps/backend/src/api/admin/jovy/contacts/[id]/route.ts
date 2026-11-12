import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { updateContactSchema } from "@jovy/lib/jovy/contacts"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"
import { deleteContactWorkflow, updateContactWorkflow } from "@jovy/workflows/jovy-contacts/contact"

async function current(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const [contact] = await service.listJovyContactRequests({ id: req.params.id })
  if (!contact) {
    res.status(404).json({ message: "Solicitud no encontrada" })
    return null
  }
  return contact
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const contact = await current(req, res)
  if (contact) res.json({ contact })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = updateContactSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "La actualización no es válida", errors: parsed.error.flatten() })
  const contact = await current(req, res)
  if (!contact) return
  const { result } = await updateContactWorkflow(req.scope).run({
    input: { id: contact.id, ...parsed.data, actor_id: getAdminActorId(req) },
  })
  res.json({ contact: result })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const contact = await current(req, res)
  if (!contact) return
  await deleteContactWorkflow(req.scope).run({ input: { id: contact.id, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
