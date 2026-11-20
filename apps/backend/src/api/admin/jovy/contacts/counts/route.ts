import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { CONTACT_REQUEST_TABLE, contactCountsFromRows, contactInboxTotals, type ContactCountRow } from "@jovy/lib/jovy/contacts"
import { canAllContactTypes } from "@jovy/lib/jovy/authz/contacts"

/**
 * Counters for the four inboxes, including their trash. The aggregation runs in
 * SQL so the Admin never loads the rows to count them; soft-deleted requests are
 * counted in `deleted` instead of the operational statuses. Authentication comes
 * from the `/admin/*` middleware; a partial inbox role cannot read consolidated
 * counters.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!canAllContactTypes(req, "read")) {
    return res.status(403).json({ type: "not_allowed", message: "No autorizado para esta operación." })
  }
  const db = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const isDeleted = db.raw("(deleted_at is not null)")
  const rows = (await db(CONTACT_REQUEST_TABLE)
    .select("contact_type", "status")
    .select(db.raw("(deleted_at is not null) as deleted"))
    .count({ count: "*" })
    .groupBy("contact_type", "status", isDeleted)) as ContactCountRow[]

  const counts = contactCountsFromRows(rows)
  res.json({ counts, totals: contactInboxTotals(counts) })
}
