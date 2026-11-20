import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import {
  CONTACT_EXPORT_MAX_ROWS,
  contactExportAllFileName,
  contactExportAllQuerySchema,
  contactListFilters,
  contactListWithDeleted,
  parseContactTypesParam,
} from "@jovy/lib/jovy/contacts"
import { toContactXlsxBuffer, type ContactExportSheet } from "@jovy/lib/jovy/contacts-xlsx"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"
import { allowedContactTypes } from "@jovy/lib/jovy/authz/contacts"

/**
 * Consolidated XLSX export: one sheet per selected bandeja, with the same
 * filters the listing uses. It replaces the historical multi-sheet workbook
 * without mixing inboxes in a single grid. The row ceiling is shared by the
 * whole download, so the operator narrows the range instead of exporting
 * everything.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = contactExportAllQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Los filtros de exportación no son válidos",
      errors: parsed.error.flatten(),
    })
  }

  const query = parsed.data
  const selectedTypes = parseContactTypesParam(query.contact_types)
  if (!selectedTypes) {
    return res.status(400).json({ message: "contact_types contiene una bandeja desconocida" })
  }
  const exportable = allowedContactTypes(req, "export")
  if (!selectedTypes.every((contactType) => exportable.includes(contactType))) {
    return res.status(403).json({ type: "not_allowed", message: "No autorizado para esta operación." })
  }

  const service = req.scope.resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const sheets: ContactExportSheet[] = []
  let total = 0

  for (const contactType of selectedTypes) {
    const contacts = await service.listJovyContactRequests(
      contactListFilters({
        contact_type: contactType,
        status: query.status,
        q: query.q,
        date_from: query.date_from,
        date_to: query.date_to,
      }),
      {
        // One extra row detects the shared ceiling before building the workbook.
        take: CONTACT_EXPORT_MAX_ROWS + 1,
        order: { created_at: "DESC", id: "DESC" },
        ...(contactListWithDeleted(query) ? { withDeleted: true } : {}),
      },
    )
    total += contacts.length
    if (total > CONTACT_EXPORT_MAX_ROWS) {
      return res.status(400).json({
        message: `La exportación supera el máximo de ${CONTACT_EXPORT_MAX_ROWS} solicitudes; acota el rango de fechas`,
      })
    }
    sheets.push({ contactType, rows: contacts })
  }

  const workbook = await toContactXlsxBuffer(sheets)
  const actorId = getAdminActorId(req)
  logger.info(
    `[jovy-contacts] exportación XLSX consolidada: bandejas=${sheets.length} filas=${total} ` +
      `detalle=${sheets.map((sheet) => `${sheet.contactType}:${sheet.rows.length}`).join(",")} ` +
      `actor=${actorId ?? "desconocido"} estado=${query.status ?? "todos"} ` +
      `desde=${query.date_from ?? "-"} hasta=${query.date_to ?? "-"} busqueda=${query.q ? "sí" : "no"}`,
  )

  res.setHeader("Content-Disposition", `attachment; filename="${contactExportAllFileName()}"`)
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  // Personal data: never keep a copy in an intermediary cache.
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Export-Count", String(total))
  res.setHeader("X-Export-Sheets", String(sheets.length))
  return res.status(200).send(workbook)
}
