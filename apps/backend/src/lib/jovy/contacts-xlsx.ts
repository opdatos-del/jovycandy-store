import ExcelJS from "exceljs"
import {
  CONTACT_EXPORT_HEADERS,
  CONTACT_TYPE_LABELS,
  type ContactCsvRow,
  type ContactType,
} from "./contacts"

/**
 * Workbook builder for the contacts export. The CSV remains the pipeline
 * format; the XLSX is the operator format, with one sheet per bandeja so a
 * consolidated download never mixes inboxes in a single grid.
 */

export type ContactExportSheet = {
  contactType: ContactType
  rows: ContactCsvRow[]
}

const COLUMN_WIDTHS = [28, 20, 16, 16, 30, 18, 10, 18, 10, 60, 22] as const

const HEADER_FILL = "FFF4F4F5"

/** Excel rejects these characters in sheet names and caps them at 31 chars. */
function sheetName(label: string) {
  const cleaned = label.replace(/[:\\/?*[\]]/g, " ").trim()
  return (cleaned || "Bandeja").slice(0, 31)
}

/** ISO keeps the timestamp unambiguous; the CSV uses the same value. */
function exportDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

export async function toContactXlsxBuffer(sheets: ContactExportSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "JovyCandy CMS"
  workbook.created = new Date()

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheetName(CONTACT_TYPE_LABELS[sheet.contactType]))
    worksheet.columns = CONTACT_EXPORT_HEADERS.map((header, index) => ({
      header,
      key: `column_${index}`,
      width: COLUMN_WIDTHS[index],
    }))

    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.alignment = { vertical: "middle" }
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } }
    })
    worksheet.views = [{ state: "frozen", ySplit: 1 }]
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: CONTACT_EXPORT_HEADERS.length },
    }

    for (const row of sheet.rows) {
      const added = worksheet.addRow([
        row.id,
        CONTACT_TYPE_LABELS[row.contact_type as ContactType] ?? row.contact_type,
        row.first_name,
        row.last_name ?? "",
        row.email,
        row.phone ?? "",
        row.country ?? "",
        row.city ?? "",
        row.postal_code ?? "",
        row.message,
        exportDate(row.created_at),
      ])
      // The message is the only free-text column that benefits from wrapping.
      added.getCell(10).alignment = { wrapText: true, vertical: "top" }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
