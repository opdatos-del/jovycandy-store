import {
  adminRequest,
  downloadAdminFile,
  type AdminDownload,
} from "@admin/shared/lib/admin-api"
import {
  contactExportAllParams,
  contactExportParams,
  contactListParams,
  type Contact,
  type ContactAuditLog,
  type ContactCounts,
  type ContactExportFormat,
  type ContactStatus,
  type ContactStatusFilter,
  type ContactType,
  type ContactUpdatePayload,
} from "../components/inbox"

export type ContactUpdateBody = Partial<ContactUpdatePayload> & {
  status?: ContactStatus
  admin_notes?: string | null
}

export type ContactListQuery = {
  contactType?: ContactType
  status?: ContactStatusFilter
  q?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export type ContactExportFilters = {
  status?: ContactStatusFilter
  q?: string
  dateFrom?: string
  dateTo?: string
}

/** Operaciones administrativas de las cuatro bandejas y su vista consolidada. */
export const contactsApi = {
  list(query: ContactListQuery) {
    const params = contactListParams(query)
    return adminRequest<{ contacts: Contact[]; count: number }>(`/admin/jovy/contacts?${params}`)
  },

  counts() {
    return adminRequest<{ counts: ContactCounts }>("/admin/jovy/contacts/counts")
  },

  detail(id: string) {
    return adminRequest<{ contact: Contact }>(`/admin/jovy/contacts/${id}`)
  },

  update(id: string, payload: ContactUpdateBody) {
    return adminRequest<{ contact: Contact }>(`/admin/jovy/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  },

  remove(id: string) {
    return adminRequest<void>(`/admin/jovy/contacts/${id}`, { method: "DELETE" })
  },

  restore(id: string) {
    return adminRequest<{ contact: Contact }>(`/admin/jovy/contacts/${id}/restore`, {
      method: "POST",
    })
  },

  audit(id: string) {
    return adminRequest<{ audit_logs: ContactAuditLog[] }>(`/admin/jovy/contacts/${id}/audit`)
  },

  exportInbox(
    contactType: ContactType,
    format: ContactExportFormat,
    filters: ContactExportFilters,
  ): Promise<AdminDownload> {
    const params = contactExportParams({ contactType, format, ...filters })
    return downloadAdminFile(
      `/admin/jovy/contacts/export?${params}`,
      `solicitudes-${contactType}-${new Date().toISOString().slice(0, 10)}.${format}`,
    )
  },

  exportAll(filters: ContactExportFilters & { contactTypes?: ContactType[] }): Promise<AdminDownload> {
    const params = contactExportAllParams(filters)
    return downloadAdminFile(
      `/admin/jovy/contacts/export-all?${params}`,
      `solicitudes-consolidado-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  },
}
