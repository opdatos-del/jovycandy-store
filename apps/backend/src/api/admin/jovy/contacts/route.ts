import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  contactListFilters,
  contactListQuerySchema,
  contactListWithDeleted,
} from "@jovy/lib/jovy/contacts"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"
import { assertContactQueryAccess } from "@jovy/lib/jovy/authz/contacts"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = contactListQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: "Los filtros no son válidos", errors: parsed.error.flatten() })
  if (!assertContactQueryAccess(req, res, "read", parsed.data.contact_type)) return
  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const { limit, offset } = parsed.data
  // `id` makes the listing order deterministic. It does not make `offset`
  // stable across concurrent inserts: new rows can shift a page boundary.
  const [contacts, count] = await service.listAndCountJovyContactRequests(
    contactListFilters(parsed.data),
    {
      take: limit,
      skip: offset,
      order: { created_at: "DESC", id: "DESC" },
      // The trash view is the only one that reads soft-deleted rows.
      ...(contactListWithDeleted(parsed.data) ? { withDeleted: true } : {}),
    },
  )
  res.json({ contacts, count, limit, offset })
}
