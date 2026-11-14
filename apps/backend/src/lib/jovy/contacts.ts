import { z } from "@medusajs/framework/zod"

export const contactTypes = ["national-sales", "international-sales", "customer-service", "catalogue"] as const

/** Persisted statuses of a request. `deleted` is a soft-delete view, not a column value. */
export const contactStatuses = ["pending", "handled"] as const

/** Values accepted by the administrative `status` filter, including the trash view. */
export const contactFilterStatuses = ["pending", "handled", "deleted"] as const

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

const contactEmail = z.string().trim().email().max(254).transform((value) => value.toLowerCase())

/** Page sizes the historical inbox exposed (10/20/50); anything else is rejected. */
export const contactPageSizes = [10, 20, 50] as const

export const DEFAULT_CONTACT_PAGE_SIZE = 20
export const MAX_CONTACT_PAGE_SIZE = 50

/** Physical table of the module model, used only by the read-only counts query. */
export const CONTACT_REQUEST_TABLE = "jovy_contact_request"

export const publicContactSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: optionalText(100),
  email: contactEmail,
  phone: optionalText(40),
  country: optionalText(100),
  city: optionalText(100),
  postal_code: optionalText(30),
  message: z.string().trim().min(1).max(4_000),
  contact_type: z.enum(contactTypes),
  website: z.string().max(200).optional().default(""),
}).strict()

/**
 * Administrator edition of the applicant data plus the two operational fields.
 * `id` and `contact_type` are deliberately absent: strict mode rejects them.
 */
export const updateContactSchema = z.object({
  first_name: z.string().trim().min(1).max(100).optional(),
  last_name: optionalText(100),
  email: contactEmail.optional(),
  phone: optionalText(40),
  country: optionalText(100),
  city: optionalText(100),
  postal_code: optionalText(30),
  status: z.enum(contactStatuses).optional(),
  admin_notes: optionalText(4_000),
}).strict()

/** Columns the administrator may edit; reused by the audit trail. */
export const contactEditableFields = ["first_name", "last_name", "email", "phone", "country", "city", "postal_code"] as const

export type ContactEditableField = (typeof contactEditableFields)[number]

export type ContactSearchFilters = {
  status?: (typeof contactFilterStatuses)[number]
  contact_type?: ContactType
  q?: string
  date_from?: string
  date_to?: string
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

/**
 * Parses an ISO-8601 calendar date (`YYYY-MM-DD`) or timestamp. Calendar dates
 * are anchored to UTC so filtering does not depend on the server time zone, and
 * loose formats ("01/01/2026") are rejected instead of guessed.
 */
export function parseContactDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value) && !ISO_TIMESTAMP_PATTERN.test(value)) return null
  if (ISO_DATE_PATTERN.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`)
    // `new Date("2026-02-31")` rolls over to March; comparing the round trip rejects it.
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
    return date
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isIsoCalendarDate(value: string) {
  return ISO_DATE_PATTERN.test(value)
}

/** Last millisecond of the UTC day, so `date_to=2026-01-31` includes the whole day. */
function endOfUtcDay(date: Date) {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1)
}

const contactDate = z
  .string()
  .trim()
  .max(40)
  .refine((value) => parseContactDate(value) !== null, { message: "La fecha no es ISO válida" })

function validDateRange(data: { date_from?: string; date_to?: string }) {
  if (!data.date_from || !data.date_to) return true
  const from = parseContactDate(data.date_from)
  const to = parseContactDate(data.date_to)
  if (!from || !to) return true
  return from.getTime() <= to.getTime()
}

const dateRangeIssue: { message: string; path: string[] } = {
  message: "date_from debe ser anterior o igual a date_to",
  path: ["date_to"],
}

export const contactListQuerySchema = z
  .object({
    status: z.enum(contactFilterStatuses).optional(),
    contact_type: z.enum(contactTypes).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    date_from: contactDate.optional(),
    date_to: contactDate.optional(),
    limit: z.coerce.number().int().refine((value) => (contactPageSizes as readonly number[]).includes(value), {
      message: "limit debe ser 10, 20 o 50",
    }).default(DEFAULT_CONTACT_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()
  .refine(validDateRange, dateRangeIssue)

/** CSV export filters. `contact_type` is mandatory so a bandeja never leaks into another. */
export const contactExportQuerySchema = z
  .object({
    format: z.literal("csv").default("csv"),
    contact_type: z.enum(contactTypes),
    status: z.enum(contactFilterStatuses).optional(),
    q: z.string().trim().min(1).max(100).optional(),
    date_from: contactDate.optional(),
    date_to: contactDate.optional(),
  })
  .strict()
  .refine(validDateRange, dateRangeIssue)

export type ContactListQuery = z.infer<typeof contactListQuerySchema>
export type ContactExportQuery = z.infer<typeof contactExportQuerySchema>
export type ContactType = (typeof contactTypes)[number]
export type ContactStatus = (typeof contactStatuses)[number]

/** Shape used by the dashboard, which only needs the operational statuses. */
export type ContactCount = { pending: number; handled: number; total: number }
export type ContactCounts = Record<ContactType, ContactCount>

/** Counters for the four inboxes, including their trash. */
export type ContactInboxCount = { pending: number; handled: number; deleted: number; total: number }
export type ContactInboxCounts = Record<ContactType, ContactInboxCount>

export type ContactCountRow = {
  contact_type: string
  status: string
  count: number | string
  deleted?: boolean | number | string | null
}

function emptyInboxCount(): ContactInboxCount {
  return { pending: 0, handled: 0, deleted: 0, total: 0 }
}

/** Every inbox renders a counter, so the response is padded to all four types. */
export function emptyContactCounts(): ContactInboxCounts {
  return Object.fromEntries(contactTypes.map((type) => [type, emptyInboxCount()])) as ContactInboxCounts
}

function isDeletedFlag(value: ContactCountRow["deleted"]) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t"
}

/**
 * Normalizes the grouped rows of the counts query. PostgreSQL returns aggregate
 * counts as strings and the boolean soft-delete flag as `t`/`f`.
 */
export function contactCountsFromRows(rows: ContactCountRow[]): ContactInboxCounts {
  const counts = emptyContactCounts()
  for (const row of rows) {
    if (!contactTypes.includes(row.contact_type as ContactType)) continue
    if (!contactStatuses.includes(row.status as ContactStatus)) continue
    const total = Number(row.count)
    if (!Number.isFinite(total) || total < 0) continue
    const type = row.contact_type as ContactType
    counts[type].total += total
    if (isDeletedFlag(row.deleted)) {
      counts[type].deleted += total
      continue
    }
    counts[type][row.status as ContactStatus] += total
  }
  return counts
}

/** Aggregate across the four inboxes for the tab badges. */
export function contactInboxTotals(counts: ContactInboxCounts): ContactInboxCount {
  return contactTypes.reduce<ContactInboxCount>(
    (totals, type) => ({
      pending: totals.pending + counts[type].pending,
      handled: totals.handled + counts[type].handled,
      deleted: totals.deleted + counts[type].deleted,
      total: totals.total + counts[type].total,
    }),
    emptyInboxCount(),
  )
}

/**
 * `%` and `_` are LIKE wildcards, so they are escaped to keep a literal search
 * term from matching every row.
 */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

function likeTerm(value: string) {
  return `%${escapeLike(value)}%`
}

/**
 * Phone numbers are stored with mixed separators ("+52 55 0000 0000"), so the
 * literal term is expanded: separators become wildcards and, for a long run of
 * digits (a phone rather than a postal code), each digit is separated too. Any
 * stored format can then match. User-supplied wildcards stay escaped.
 */
function phoneLikeTerm(value: string) {
  const escaped = escapeLike(value)
  if (/^\d{6,}$/.test(value)) return `%${escaped.split("").join("%")}%`
  return `%${escaped.replace(/[\s().+-]+/g, "%")}%`
}

/**
 * The search runs in SQL (`$or` + `$ilike`) instead of in memory, otherwise
 * `take`/`skip` would slice the list before filtering and hide matching rows.
 */
export function contactListFilters(query: ContactSearchFilters) {
  const filters: Record<string, unknown> = {}
  if (query.contact_type) filters.contact_type = query.contact_type
  if (query.status === "pending" || query.status === "handled") filters.status = query.status

  if (query.status === "deleted") {
    // `withDeleted: true` disables MikroORM's implicit `deleted_at is null`;
    // this comparator narrows the trash view to deleted rows only.
    filters.deleted_at = { $ne: null }
  }

  const createdAt: Record<string, Date> = {}
  if (query.date_from) {
    const from = parseContactDate(query.date_from)
    if (from) createdAt.$gte = from
  }
  if (query.date_to) {
    const to = parseContactDate(query.date_to)
    if (to) createdAt.$lte = isIsoCalendarDate(query.date_to) ? endOfUtcDay(to) : to
  }
  if (Object.keys(createdAt).length > 0) filters.created_at = createdAt

  if (query.q) {
    const pattern = likeTerm(query.q)
    const phonePattern = phoneLikeTerm(query.q)
    filters.$or = [
      { first_name: { $ilike: pattern } },
      { last_name: { $ilike: pattern } },
      { email: { $ilike: pattern } },
      { phone: { $ilike: phonePattern } },
      { city: { $ilike: pattern } },
      { country: { $ilike: pattern } },
      { postal_code: { $ilike: pattern } },
      { contact_type: { $ilike: pattern } },
    ]
  }
  return filters
}

/**
 * The trash view needs `withDeleted: true`; every other view relies on the
 * module default that hides soft-deleted rows.
 */
export function contactListWithDeleted(query: Pick<ContactSearchFilters, "status">) {
  return query.status === "deleted"
}

/** Empty optional text fields are stored as `null` to avoid ""/null drift. */
export function normalizeOptionalText(value: string | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Historical export columns, in the same order the old admin used. */
export const CONTACT_EXPORT_HEADERS = [
  "ID",
  "Tipo",
  "Nombre",
  "Apellido",
  "Email",
  "Teléfono",
  "País",
  "Ciudad",
  "CP",
  "Mensaje",
  "Creado",
] as const

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  "national-sales": "Ventas Nacional",
  "international-sales": "Ventas Exportación",
  "customer-service": "Atención a clientes",
  catalogue: "Catálogo",
}

/**
 * Hard ceiling for one export. It bounds memory and keeps a single request from
 * dumping the whole table; callers must narrow the date range instead.
 */
export const CONTACT_EXPORT_MAX_ROWS = 5_000

export type ContactCsvRow = {
  id: string
  contact_type: string
  first_name: string
  last_name?: string | null
  email: string
  phone?: string | null
  country?: string | null
  city?: string | null
  postal_code?: string | null
  message: string
  created_at: Date | string
}

/**
 * A cell starting with `=`, `+`, `-`, `@` or a tab is interpreted as a formula
 * by spreadsheet software (CSV injection), so it is prefixed with an apostrophe.
 */
function csvCell(value: unknown) {
  if (value === null || value === undefined) return ""
  let text = value instanceof Date ? value.toISOString() : String(value)
  // Excel treats a bare CR as a row break; normalizing keeps the quoting valid.
  text = text.replace(/\r\n?/g, "\n")
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/**
 * Serializes the historical columns to CSV. The BOM makes Excel detect UTF-8,
 * and the line ending is CRLF for the same reason.
 */
export function toContactCsv(rows: ContactCsvRow[]) {
  const lines = [CONTACT_EXPORT_HEADERS.join(",")]
  for (const row of rows) {
    const typeLabel = CONTACT_TYPE_LABELS[row.contact_type as ContactType] ?? row.contact_type
    lines.push(
      [
        row.id,
        typeLabel,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.country,
        row.city,
        row.postal_code,
        row.message,
        row.created_at,
      ]
        .map(csvCell)
        .join(","),
    )
  }
  return `\ufeff${lines.join("\r\n")}\r\n`
}

/** ASCII filename; the bandeja is part of the name so downloads stay distinguishable. */
export function contactExportFileName(contactType: ContactType, stamp = new Date()) {
  return `solicitudes-${contactType}-${stamp.toISOString().slice(0, 10)}.csv`
}
