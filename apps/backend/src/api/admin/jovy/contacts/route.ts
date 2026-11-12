import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { contactListQuerySchema } from "@jovy/lib/jovy/contacts"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = contactListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: "Los filtros no son válidos", errors: parsed.error.flatten() })
  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const filters: Record<string, unknown> = {}
  if (parsed.data.status) filters.status = parsed.data.status
  if (parsed.data.contact_type) filters.contact_type = parsed.data.contact_type
  const contacts = await service.listJovyContactRequests(filters, { order: { created_at: "DESC" } })
  const q = parsed.data.q?.toLowerCase()
  const filtered = q ? contacts.filter((contact) =>
    [contact.first_name, contact.last_name, contact.email, contact.contact_type].filter(Boolean).join(" ").toLowerCase().includes(q),
  ) : contacts
  res.json({ contacts: filtered })
}
