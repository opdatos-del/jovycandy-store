import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import {
  CONTACT_EXPORT_MAX_ROWS,
  contactExportFileName,
  contactExportQuerySchema,
  contactListFilters,
  contactListWithDeleted,
  toContactCsv,
} from "@jovy/lib/jovy/contacts"
import { toContactXlsxBuffer } from "@jovy/lib/jovy/contacts-xlsx"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"
import { assertContactQueryAccess } from "@jovy/lib/jovy/authz/contacts"

/**
 * CSV or XLSX export of one inbox. `contact_type` is mandatory so a download
 * can never mix two bandejas. The filters are the same ones the listing uses,
 * and the row ceiling forces the operator to narrow the date range instead of
 * dumping the table. The audit trail lives in the structured log: the
 * per-request audit table is keyed by `contact_request_id`, so an export (which
 * spans rows) would have no valid owner there. Search terms are never logged
 * because they can contain an email or a phone number.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = contactExportQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ message: "Los filtros de exportación no son válidos", errors: parsed.error.flatten() })
  }

  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = parsed.data
  if (!assertContactQueryAccess(req, res, "export", query.contact_type)) return

  const contacts = await service.listJovyContactRequests(contactListFilters(query), {
    // One extra row is enough to know the ceiling was crossed.
    take: CONTACT_EXPORT_MAX_ROWS + 1,
    order: { created_at: "DESC", id: "DESC" },
    ...(contactListWithDeleted(query) ? { withDeleted: true } : {}),
  })

  if (contacts.length > CONTACT_EXPORT_MAX_ROWS) {
    return res.status(400).json({
      message: `La exportación supera el máximo de ${CONTACT_EXPORT_MAX_ROWS} solicitudes; acota el rango de fechas`,
    })
  }

  const format = query.format
  const actorId = getAdminActorId(req)
  logger.info(
    `[jovy-contacts] exportación ${format.toUpperCase()}: bandeja=${query.contact_type} filas=${contacts.length} ` +
      `actor=${actorId ?? "desconocido"} estado=${query.status ?? "todos"} ` +
      `desde=${query.date_from ?? "-"} hasta=${query.date_to ?? "-"} busqueda=${query.q ? "sí" : "no"}`,
  )

  const fileName = contactExportFileName(query.contact_type, new Date(), format)
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
  // Personal data: never keep a copy in an intermediary cache.
  res.setHeader("Cache-Control", "no-store")
  // Registros exportados (no líneas del CSV): un mensaje multilínea ocupa varias
  // líneas físicas. La UI usa este número en el aviso de descarga.
  res.setHeader("X-Export-Count", String(contacts.length))

  if (format === "xlsx") {
    const workbook = await toContactXlsxBuffer([{ contactType: query.contact_type, rows: contacts }])
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    return res.status(200).send(workbook)
  }

  const csv = toContactCsv(contacts)
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  return res.status(200).send(csv)
}
