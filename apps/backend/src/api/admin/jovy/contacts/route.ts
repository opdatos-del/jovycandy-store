import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { contactListFilters, contactListQuerySchema } from "@jovy/lib/jovy/contacts"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = contactListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: "Los filtros no son válidos", errors: parsed.error.flatten() })
  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const { limit, offset } = parsed.data
  // `id` makes the listing order deterministic. It does not make `offset`
  // stable across concurrent inserts: new rows can shift a page boundary.
  const [contacts, count] = await service.listAndCountJovyContactRequests(
    contactListFilters(parsed.data),
    { take: limit, skip: offset, order: { created_at: "DESC", id: "DESC" } },
  )
  res.json({ contacts, count, limit, offset })
}
