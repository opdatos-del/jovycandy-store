export type ContactType = "national-sales" | "international-sales" | "customer-service" | "catalogue"
export type ContactStatus = "pending" | "handled"
/** `deleted` is a search view, not a persisted status. */
export type ContactFilterStatus = ContactStatus | "deleted"
export type ContactStatusFilter = ContactFilterStatus | "all"

export type Contact = {
  id: string
  first_name: string
  last_name: string | null
  email: string
  phone: string | null
  country: string | null
  city: string | null
  postal_code: string | null
  contact_type: ContactType
  message: string
  status: ContactStatus
  admin_notes: string | null
  created_at: string
  updated_at?: string | null
  handled_at: string | null
  handled_by: string | null
  deleted_at?: string | null
}

export type ContactAuditLog = {
  id: string
  actor_id: string | null
  action: "create" | "status" | "note" | "delete" | "restore" | "update"
  created_at: string
}

export type ContactCount = { pending: number; handled: number; deleted: number; total: number }
export type ContactCounts = Record<ContactType, ContactCount>

export type ContactDraft = {
  first_name: string
  last_name: string
  email: string
  phone: string
  country: string
  city: string
  postal_code: string
}

export type ContactDraftErrors = Partial<Record<keyof ContactDraft, string>>

export type ContactUpdatePayload = {
  first_name: string
  last_name: string | null
  email: string
  phone: string | null
  country: string | null
  city: string | null
  postal_code: string | null
}

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  "national-sales": "Ventas nacionales",
  "international-sales": "Ventas internacionales",
  "customer-service": "Atención al cliente",
  catalogue: "Catálogo",
}

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  pending: "Pendiente",
  handled: "Atendido",
}

export const CONTACT_TAB_LABELS: Record<ContactStatusFilter, string> = {
  all: "Todos",
  pending: "Nuevo",
  handled: "Atendidos",
  deleted: "Papelera",
}

export const CONTACT_AUDIT_LABELS: Record<ContactAuditLog["action"], string> = {
  create: "Alta",
  status: "Cambio de estado",
  note: "Nota interna",
  delete: "Borrado lógico",
  restore: "Restauración",
  update: "Edición de datos",
}

/** Page sizes exposed by the historical inbox and accepted by the backend. */
export const CONTACT_PAGE_SIZES = [10, 20, 50] as const
export type ContactPageSize = (typeof CONTACT_PAGE_SIZES)[number]

export const CONTACT_PAGE_SIZE = 20
export const MESSAGE_PREVIEW_LENGTH = 100
export const CONTACT_POLL_INTERVAL_MS = 30_000

export const CONTACT_SEARCH_PLACEHOLDER =
  "Nombre, apellido, email, teléfono, ciudad, país o CP"

export const CONTACT_STATUS_TABS: ContactStatusFilter[] = ["all", "pending", "handled", "deleted"]

export function contactName(contact: Pick<Contact, "first_name" | "last_name">) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ")
}

export function isContactDeleted(contact: Pick<Contact, "deleted_at">) {
  return Boolean(contact.deleted_at)
}

export function contactStatusLabel(contact: Pick<Contact, "status" | "deleted_at">) {
  return isContactDeleted(contact) ? "Eliminado" : CONTACT_STATUS_LABELS[contact.status]
}

export function normalizeContactLimit(value: number | undefined): ContactPageSize {
  return (CONTACT_PAGE_SIZES as readonly number[]).includes(value ?? -1)
    ? (value as ContactPageSize)
    : CONTACT_PAGE_SIZE
}

/**
 * The consolidated view sends the type; a fixed inbox never does, so the browser
 * cannot widen its own dataset. The backend validates the value regardless.
 * `all` is intentionally not sent: the listing defaults to live rows only.
 */
export function contactListParams(query: {
  contactType?: ContactType
  status?: ContactStatusFilter
  q?: string
  dateFrom?: string
  dateTo?: string
  offset?: number
  limit?: number
}) {
  const params = new URLSearchParams()
  if (query.contactType) params.set("contact_type", query.contactType)
  if (query.status && query.status !== "all") params.set("status", query.status)
  const search = query.q?.trim()
  if (search) params.set("q", search)
  if (query.dateFrom) params.set("date_from", query.dateFrom)
  if (query.dateTo) params.set("date_to", query.dateTo)
  params.set("limit", String(normalizeContactLimit(query.limit)))
  params.set("offset", String(Math.max(0, query.offset ?? 0)))
  return params.toString()
}

/**
 * Export always names one inbox: the endpoint rejects a request without
 * `contact_type`, which is what prevents a download from mixing bandejas.
 */
export function contactExportParams(query: {
  contactType: ContactType
  status?: ContactStatusFilter
  q?: string
  dateFrom?: string
  dateTo?: string
}) {
  const params = new URLSearchParams()
  params.set("contact_type", query.contactType)
  params.set("format", "csv")
  if (query.status && query.status !== "all") params.set("status", query.status)
  const search = query.q?.trim()
  if (search) params.set("q", search)
  if (query.dateFrom) params.set("date_from", query.dateFrom)
  if (query.dateTo) params.set("date_to", query.dateTo)
  return params.toString()
}

export function previewMessage(message: string, max = MESSAGE_PREVIEW_LENGTH) {
  const compact = message.replace(/\s+/g, " ").trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, max).trimEnd()}…`
}

export function locationText(contact: Pick<Contact, "city" | "country" | "postal_code">) {
  const parts = [contact.city, contact.country, contact.postal_code].filter(
    (part): part is string => Boolean(part),
  )
  return parts.length > 0 ? parts.join(", ") : "—"
}

export function emptyContactCount(): ContactCount {
  return { pending: 0, handled: 0, deleted: 0, total: 0 }
}

/** Sums the four inboxes for the consolidated view and returns one type otherwise. */
export function inboxCounts(counts: ContactCounts | null, contactType?: ContactType): ContactCount {
  if (contactType) return counts?.[contactType] ?? emptyContactCount()
  if (!counts) return emptyContactCount()
  return Object.values(counts).reduce(
    (total, count) => ({
      pending: total.pending + count.pending,
      handled: total.handled + count.handled,
      deleted: total.deleted + count.deleted,
      total: total.total + count.total,
    }),
    emptyContactCount(),
  )
}

/**
 * Counters rendered inside each tab. `all` excludes the trash because the
 * default listing hides soft-deleted rows, so the badge always matches the
 * number of rows the operator can actually see.
 */
export function inboxTabCounts(count: ContactCount): Record<ContactStatusFilter, number> {
  return {
    all: count.pending + count.handled,
    pending: count.pending,
    handled: count.handled,
    deleted: count.deleted,
  }
}

export function formatDateParts(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    date: new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date),
    time: new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  }
}

export function formatDateTime(value: string | null | undefined) {
  const parts = formatDateParts(value)
  return parts ? `${parts.date} ${parts.time}` : "—"
}

/**
 * Page numbers with at most two ellipses. Keeping the rule pure makes the
 * numeric paginator deterministic for the consolidated and fixed inboxes.
 */
export function paginationItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  const total = Math.max(1, Math.trunc(totalPages))
  const current = Math.min(Math.max(1, Math.trunc(page)), total)
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((value) => value >= 1 && value <= total)
    .sort((left, right) => left - right)

  const items: Array<number | "ellipsis"> = []
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) items.push("ellipsis")
    items.push(value)
  })
  return items
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[+()\d\s.-]+$/
const POSTAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s-]*$/

/** Mirrors the backend limits so the modal can fail before the request. */
export function validateContactDraft(draft: ContactDraft): ContactDraftErrors {
  const errors: ContactDraftErrors = {}
  const firstName = draft.first_name.trim()
  if (!firstName) errors.first_name = "El nombre es obligatorio."
  else if (firstName.length > 100) errors.first_name = "El nombre admite 100 caracteres como máximo."

  if (draft.last_name.trim().length > 100) {
    errors.last_name = "El apellido admite 100 caracteres como máximo."
  }

  const email = draft.email.trim()
  if (!email) errors.email = "El email es obligatorio."
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = "Usa un email válido, por ejemplo nombre@dominio.com."
  }

  const phone = draft.phone.trim()
  if (phone) {
    const digits = phone.replace(/\D/g, "")
    if (phone.length > 40 || !PHONE_PATTERN.test(phone) || digits.length < 7 || digits.length > 15) {
      errors.phone = "Usa entre 7 y 15 dígitos; se admiten +, espacios, puntos y guiones."
    }
  }

  if (draft.country.trim().length > 100) {
    errors.country = "El país admite 100 caracteres como máximo."
  }
  if (draft.city.trim().length > 100) {
    errors.city = "La ciudad admite 100 caracteres como máximo."
  }

  const postalCode = draft.postal_code.trim()
  if (postalCode && (postalCode.length > 30 || !POSTAL_CODE_PATTERN.test(postalCode))) {
    errors.postal_code = "Usa hasta 30 letras o números; se admiten espacios y guiones."
  }

  return errors
}

export function hasContactDraftErrors(errors: ContactDraftErrors) {
  return Object.keys(errors).length > 0
}

export function contactDraftFrom(contact: Contact): ContactDraft {
  return {
    first_name: contact.first_name,
    last_name: contact.last_name ?? "",
    email: contact.email,
    phone: contact.phone ?? "",
    country: contact.country ?? "",
    city: contact.city ?? "",
    postal_code: contact.postal_code ?? "",
  }
}

function optionalText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Only the applicant fields are sent. `contact_type`, `id`, `message` and the
 * operational status stay out of the edit modal by construction.
 */
export function contactUpdatePayload(draft: ContactDraft): ContactUpdatePayload {
  return {
    first_name: draft.first_name.trim(),
    last_name: optionalText(draft.last_name),
    email: draft.email.trim().toLowerCase(),
    phone: optionalText(draft.phone),
    country: optionalText(draft.country),
    city: optionalText(draft.city),
    postal_code: optionalText(draft.postal_code),
  }
}

/**
 * Returns ids that are both unknown and newer than the session start. The
 * timestamp guard keeps pagination or reordering from flagging an old row as
 * "new". `null` means the baseline has not been recorded yet.
 */
export function newContactIds(
  previous: ReadonlySet<string> | null,
  contacts: Pick<Contact, "id" | "created_at">[],
  since: number,
) {
  if (previous === null) return new Set<string>()
  return new Set(
    contacts
      .filter((contact) => !previous.has(contact.id))
      .filter((contact) => {
        const created = new Date(contact.created_at).getTime()
        return !Number.isNaN(created) && created >= since
      })
      .map((contact) => contact.id),
  )
}

export function mergeSeenIds(previous: ReadonlySet<string>, contacts: Pick<Contact, "id">[]) {
  return new Set([...previous, ...contacts.map((contact) => contact.id)])
}
