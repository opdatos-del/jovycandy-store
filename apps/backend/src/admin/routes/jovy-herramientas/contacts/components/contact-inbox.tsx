import { ArrowDownTray, ArrowPath } from "@medusajs/icons"
import { Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useRef, useState } from "react"
import { ContactAuditDialog } from "./contact-audit-dialog"
import { ContactDetailDialog } from "./contact-detail-dialog"
import { ContactEditDialog } from "./contact-edit-dialog"
import { ContactInboxFilters } from "./contact-inbox-filters"
import { ContactTable } from "./contact-table"
import {
  CONTACT_PAGE_SIZE,
  CONTACT_POLL_INTERVAL_MS,
  CONTACT_TYPE_LABELS,
  contactExportParams,
  contactListParams,
  contactName,
  contactUpdatePayload,
  inboxCounts,
  inboxTabCounts,
  mergeSeenIds,
  newContactIds,
  normalizeContactLimit,
  paginationItems,
  parseExportCount,
  type Contact,
  type ContactAuditLog,
  type ContactCounts,
  type ContactDraft,
  type ContactPageSize,
  type ContactStatus,
  type ContactStatusFilter,
  type ContactType,
} from "./inbox"

type ApiErrorBody = {
  message?: string
  errors?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    const fieldMessage = body?.errors?.fieldErrors
      ? Object.values(body.errors.fieldErrors).flat()[0]
      : undefined
    throw new Error(
      fieldMessage ??
        body?.errors?.formErrors?.[0] ??
        body?.message ??
        `La operación falló (${response.status}).`,
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

function csvFileName(response: Response, contactType: ContactType) {
  const disposition = response.headers.get("Content-Disposition") ?? ""
  const match = /filename="([^"]+)"/.exec(disposition)
  return (
    match?.[1] ??
    `solicitudes-${contactType}-${new Date().toISOString().slice(0, 10)}.csv`
  )
}

type ContactInboxProps = {
  title: string
  description?: string
  /** Fixed inboxes keep the type on the server side; the consolidated view omits it. */
  contactType?: ContactType
}

type BusyAction = "status" | "delete" | "restore"

/**
 * Bandeja compartida por las cuatro rutas laterales y la vista consolidada.
 * Replica la tabla histórica (seis columnas, scroll horizontal, pestañas con
 * contadores reales), añade paginación numerada, exportación por bandeja y
 * actualización periódica pausada cuando la pestaña está oculta.
 */
export function ContactInbox({ title, description, contactType }: ContactInboxProps) {
  const prompt = usePrompt()
  const [statusFilter, setStatusFilter] = useState<ContactStatusFilter>("pending")
  const [typeFilter, setTypeFilter] = useState<ContactType | "">("")
  const [searchDraft, setSearchDraft] = useState("")
  const [search, setSearch] = useState("")
  const [dateFromDraft, setDateFromDraft] = useState("")
  const [dateToDraft, setDateToDraft] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [queryVersion, setQueryVersion] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<ContactPageSize>(CONTACT_PAGE_SIZE)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [counts, setCounts] = useState<ContactCounts | null>(null)
  const [countsError, setCountsError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  const [busy, setBusy] = useState<{ id: string; action: BusyAction } | null>(null)
  const [exporting, setExporting] = useState(false)

  const [detail, setDetail] = useState<Contact | null>(null)
  const [detailAudit, setDetailAudit] = useState<ContactAuditLog[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  const [editTarget, setEditTarget] = useState<Contact | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [auditTarget, setAuditTarget] = useState<Contact | null>(null)
  const [auditLogs, setAuditLogs] = useState<ContactAuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)

  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const countsRequestRef = useRef(0)
  const seenIdsRef = useRef<Set<string> | null>(null)
  const sessionStartRef = useRef(Date.now())
  const detailRequestRef = useRef(0)
  const auditRequestRef = useRef(0)
  const lastTriggerRef = useRef<HTMLElement | null>(null)
  const refreshRef = useRef<() => void>(() => undefined)

  const listType = contactType ?? (typeFilter || undefined)
  const exportType = listType ?? null
  const filterKey = [listType ?? "", statusFilter, search, dateFrom, dateTo, limit].join("|")
  const totalPages = Math.max(1, Math.ceil(total / limit))

  // Un cambio de filtro invalida la detección de novedades y los datos visibles.
  // La página no entra en la clave: paginar conserva los IDs ya conocidos.
  useEffect(() => {
    seenIdsRef.current = null
    sessionStartRef.current = Date.now()
    setNewIds(new Set())
    setContacts([])
    setTotal(0)
    setListError(null)
  }, [filterKey])

  const loadContacts = useCallback(
    async (options?: { silent?: boolean; manual?: boolean; force?: boolean }) => {
      if (options?.silent && !options?.force && inFlightRef.current) return
      const requestId = ++requestIdRef.current
      inFlightRef.current = true
      if (options?.manual) setRefreshing(true)
      if (!options?.silent) setLoading(true)

      try {
        const params = contactListParams({
          contactType: listType,
          status: statusFilter,
          q: search,
          dateFrom,
          dateTo,
          limit,
          offset: (page - 1) * limit,
        })
        const result = await api<{ contacts: Contact[]; count: number }>(
          `/admin/jovy/contacts?${params}`,
        )
        if (requestId !== requestIdRef.current) return

        const previous = seenIdsRef.current
        const appeared = newContactIds(previous, result.contacts, sessionStartRef.current)
        seenIdsRef.current = mergeSeenIds(previous ?? new Set(), result.contacts)
        setContacts(result.contacts)
        setTotal(result.count)
        setListError(null)
        if (appeared.size > 0) {
          setNewIds((current) => new Set([...current, ...appeared]))
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setListError(errorMessage(error, "No se pudieron cargar las solicitudes."))
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
          inFlightRef.current = false
        }
      }
    },
    [listType, statusFilter, search, dateFrom, dateTo, limit, page],
  )

  const loadCounts = useCallback(async (silent = false) => {
    const requestId = ++countsRequestRef.current
    try {
      const result = await api<{ counts: ContactCounts }>("/admin/jovy/contacts/counts")
      if (requestId !== countsRequestRef.current) return
      setCounts(result.counts)
      setCountsError(null)
    } catch (error) {
      if (requestId === countsRequestRef.current && !silent) {
        setCountsError(errorMessage(error, "No se pudieron cargar los contadores."))
      }
    }
  }, [])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts, queryVersion])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  useEffect(() => {
    if (page <= totalPages) return
    setPage(totalPages)
  }, [page, totalPages])

  // El sondeo se pausa con la pestaña oculta y se limpia al desmontar. Al volver
  // a estar visible se refresca una vez, sin esperar al siguiente intervalo.
  refreshRef.current = () => {
    void loadContacts({ silent: true })
    void loadCounts(true)
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return
      refreshRef.current()
    }, CONTACT_POLL_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshRef.current()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const tabCounts = inboxTabCounts(inboxCounts(counts, listType))

  const refresh = () => {
    setNotice(null)
    void loadContacts({ silent: true, manual: true, force: true })
    void loadCounts(true)
  }

  const applyFilters = () => {
    if (dateFromDraft && dateToDraft && dateFromDraft > dateToDraft) {
      setFilterError("La fecha Desde debe ser anterior o igual a Hasta.")
      return
    }
    setFilterError(null)
    setNotice(null)
    setSearch(searchDraft.trim())
    setDateFrom(dateFromDraft)
    setDateTo(dateToDraft)
    setPage(1)
    setQueryVersion((version) => version + 1)
  }

  const resetFilters = () => {
    setFilterError(null)
    setNotice(null)
    setSearchDraft("")
    setDateFromDraft("")
    setDateToDraft("")
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
    setQueryVersion((version) => version + 1)
  }

  const changeStatus = (value: ContactStatusFilter) => {
    setStatusFilter(value)
    setPage(1)
    setFilterError(null)
    setNotice(null)
  }

  const changeType = (value: ContactType | "") => {
    setTypeFilter(value)
    setPage(1)
    setNotice(null)
  }

  const changeLimit = (value: ContactPageSize) => {
    setLimit(normalizeContactLimit(value))
    setPage(1)
    setNotice(null)
  }

  const changePage = (next: number) => {
    setPage(Math.min(Math.max(1, next), totalPages))
    setNotice(null)
  }

  const showDetail = async (contact: Contact, trigger?: HTMLButtonElement) => {
    if (trigger) lastTriggerRef.current = trigger
    const requestId = ++detailRequestRef.current
    setDetail(contact)
    setNotes(contact.admin_notes ?? "")
    setDetailAudit([])
    setDetailError(null)
    setDetailLoading(true)
    setSavingNotes(false)

    try {
      const [contactResult, auditResult] = await Promise.all([
        api<{ contact: Contact }>(`/admin/jovy/contacts/${contact.id}`),
        api<{ audit_logs: ContactAuditLog[] }>(`/admin/jovy/contacts/${contact.id}/audit`),
      ])
      if (requestId !== detailRequestRef.current) return
      setDetail(contactResult.contact)
      setNotes(contactResult.contact.admin_notes ?? "")
      setDetailAudit(auditResult.audit_logs)
    } catch (error) {
      if (requestId === detailRequestRef.current) {
        setDetailError(errorMessage(error, "No se pudo abrir la solicitud."))
      }
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    detailRequestRef.current += 1
    setDetail(null)
    setDetailAudit([])
    setDetailError(null)
    setDetailLoading(false)
    setSavingNotes(false)
    setNotes("")
  }

  const closeEdit = () => {
    setEditTarget(null)
    requestAnimationFrame(() => {
      if (lastTriggerRef.current?.isConnected) lastTriggerRef.current.focus()
    })
  }

  const editFromDetail = () => {
    if (!detail) return
    setEditTarget(detail)
    closeDetail()
  }

  const saveEdit = async (draft: ContactDraft) => {
    const id = editTarget?.id
    if (!id) return "No hay una solicitud seleccionada."
    setSavingEdit(true)
    try {
      await api<{ contact: Contact }>(`/admin/jovy/contacts/${id}`, {
        method: "PUT",
        body: JSON.stringify(contactUpdatePayload(draft)),
      })
      setEditTarget(null)
      requestAnimationFrame(() => {
        if (lastTriggerRef.current?.isConnected) lastTriggerRef.current.focus()
      })
      const message = "Solicitud actualizada."
      setNotice(message)
      toast.success(message)
      await Promise.all([loadContacts({ silent: true, force: true }), loadCounts(true)])
      return null
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la solicitud.")
      toast.error(message)
      return message
    } finally {
      setSavingEdit(false)
    }
  }

  const markStatus = async (contact: Contact, status: ContactStatus) => {
    setActionError(null)
    setBusy({ id: contact.id, action: "status" })
    try {
      const result = await api<{ contact: Contact }>(`/admin/jovy/contacts/${contact.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
      const message =
        status === "handled" ? "Solicitud marcada como atendida." : "Solicitud devuelta a pendientes."
      setNotice(message)
      toast.success(message)
      setNewIds((current) => {
        if (!current.has(contact.id)) return current
        const next = new Set(current)
        next.delete(contact.id)
        return next
      })
      if (detail?.id === contact.id) {
        setDetail(result.contact)
        setNotes(result.contact.admin_notes ?? "")
        try {
          const auditResult = await api<{ audit_logs: ContactAuditLog[] }>(
            `/admin/jovy/contacts/${contact.id}/audit`,
          )
          setDetailAudit(auditResult.audit_logs)
        } catch {
          // El cambio de estado ya se guardó; la auditoría se reintenta al reabrir.
        }
      }
      await Promise.all([loadContacts({ silent: true, force: true }), loadCounts(true)])
    } catch (error) {
      const message = errorMessage(error, "No se pudo cambiar el estado de la solicitud.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  const deleteContact = async (contact: Contact) => {
    const confirmed = await prompt({
      title: "Eliminar solicitud",
      description: `La solicitud de ${contactName(contact)} se moverá a la papelera. Podrás restaurarla desde la pestaña Papelera.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setActionError(null)
    setBusy({ id: contact.id, action: "delete" })
    try {
      await api(`/admin/jovy/contacts/${contact.id}`, { method: "DELETE" })
      if (detail?.id === contact.id) closeDetail()
      const message = "Solicitud movida a la papelera."
      setNotice(message)
      toast.success(message)
      await Promise.all([loadContacts({ silent: true, force: true }), loadCounts(true)])
    } catch (error) {
      const message = errorMessage(error, "No se pudo eliminar la solicitud.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  const restoreContact = async (contact: Contact) => {
    const confirmed = await prompt({
      title: "Restaurar solicitud",
      description: `La solicitud de ${contactName(contact)} volverá a su bandeja con el estado que tenía antes de eliminarse.`,
      confirmText: "Restaurar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setActionError(null)
    setBusy({ id: contact.id, action: "restore" })
    try {
      await api<{ contact: Contact }>(`/admin/jovy/contacts/${contact.id}/restore`, {
        method: "POST",
      })
      if (detail?.id === contact.id) closeDetail()
      const message = "Solicitud restaurada."
      setNotice(message)
      toast.success(message)
      await Promise.all([loadContacts({ silent: true, force: true }), loadCounts(true)])
    } catch (error) {
      const message = errorMessage(error, "No se pudo restaurar la solicitud.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  const openAudit = async (contact: Contact) => {
    // Cada apertura invalida la anterior: abrir A y luego B no permite que la
    // respuesta lenta de A sobrescriba el historial de B.
    const requestId = ++auditRequestRef.current
    setAuditTarget(contact)
    setAuditLogs([])
    setAuditError(null)
    setAuditLoading(true)
    try {
      const result = await api<{ audit_logs: ContactAuditLog[] }>(
        `/admin/jovy/contacts/${contact.id}/audit`,
      )
      if (requestId !== auditRequestRef.current) return
      setAuditLogs(result.audit_logs)
    } catch (error) {
      if (requestId !== auditRequestRef.current) return
      setAuditError(errorMessage(error, "No se pudo cargar la auditoría."))
    } finally {
      if (requestId === auditRequestRef.current) setAuditLoading(false)
    }
  }

  const closeAudit = () => {
    auditRequestRef.current += 1
    setAuditTarget(null)
    setAuditLogs([])
    setAuditError(null)
    setAuditLoading(false)
  }

  const saveNotes = async () => {
    if (!detail) return
    const id = detail.id
    const requestId = detailRequestRef.current
    setSavingNotes(true)
    setDetailError(null)
    try {
      const result = await api<{ contact: Contact }>(`/admin/jovy/contacts/${id}`, {
        method: "PUT",
        body: JSON.stringify({ admin_notes: notes.trim() ? notes.trim() : null }),
      })
      if (requestId !== detailRequestRef.current) return
      setDetail(result.contact)
      setNotes(result.contact.admin_notes ?? "")
      try {
        const auditResult = await api<{ audit_logs: ContactAuditLog[] }>(
          `/admin/jovy/contacts/${id}/audit`,
        )
        if (requestId === detailRequestRef.current) setDetailAudit(auditResult.audit_logs)
      } catch {
        // Las notas ya se guardaron; el historial se recupera al reabrir el detalle.
      }
      const message = "Notas internas guardadas."
      setNotice(message)
      toast.success(message)
    } catch (error) {
      if (requestId === detailRequestRef.current) {
        setDetailError(errorMessage(error, "No se pudieron guardar las notas."))
      }
    } finally {
      if (requestId === detailRequestRef.current) setSavingNotes(false)
    }
  }

  const runExport = async () => {
    if (!exportType) return
    setExporting(true)
    setActionError(null)
    try {
      const params = contactExportParams({
        contactType: exportType,
        status: statusFilter,
        q: search,
        dateFrom,
        dateTo,
      })
      const response = await fetch(`/admin/jovy/contacts/export?${params}`, {
        credentials: "include",
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null
        throw new Error(body?.message ?? `La exportación falló (${response.status}).`)
      }

      // El cuerpo se conserva como bytes: `response.text()` descarta el BOM y
      // Excel dejaría de detectar UTF-8 en la descarga.
      const buffer = await response.arrayBuffer()
      const fileName = csvFileName(response, exportType)
      const url = URL.createObjectURL(new Blob([buffer], { type: "text/csv;charset=utf-8" }))
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)

      const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(buffer)
      const rows = parseExportCount(response.headers.get("X-Export-Count"))
        ?? Math.max(0, text.replace(/^\ufeff/, "").trimEnd().split(/\r?\n/).length - 1)
      const message = `CSV exportado: ${rows} ${rows === 1 ? "solicitud" : "solicitudes"} de ${CONTACT_TYPE_LABELS[exportType]}.`
      setNotice(message)
      toast.success(message)
    } catch (error) {
      const message = errorMessage(error, "No se pudo exportar la bandeja.")
      setActionError(message)
      toast.error(message)
    } finally {
      setExporting(false)
    }
  }

  const filtersActive = Boolean(search || dateFrom || dateTo)
  const emptyState = filtersActive
    ? {
        title: "Sin resultados",
        description: "No hay solicitudes para los filtros seleccionados.",
      }
    : statusFilter === "deleted"
      ? {
          title: "Papelera vacía",
          description: "Las solicitudes eliminadas aparecerán aquí y podrás restaurarlas.",
        }
      : statusFilter === "pending"
        ? {
            title: "Sin solicitudes nuevas",
            description: "No hay pendientes que coincidan con esta bandeja.",
          }
        : statusFilter === "handled"
          ? {
              title: "Sin solicitudes atendidas",
              description: "Aún no hay seguimientos cerrados en esta bandeja.",
            }
          : {
              title: "Sin solicitudes",
              description: "Todavía no se ha recibido ninguna solicitud en esta bandeja.",
            }

  return (
    <div className="flex flex-col gap-y-4" data-jovy-quality data-testid="jovy-contact-inbox">
      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Heading level="h1" className="jovy-title">{title}</Heading>
            {description && (
              <Text size="small" className="text-ui-fg-subtle mt-1">
                {description}
              </Text>
            )}
            <Text size="xsmall" className="text-ui-fg-subtle mt-2">
              {contactType
                ? `Bandeja fija: ${CONTACT_TYPE_LABELS[contactType]}. Las solicitudes de otras bandejas no se consultan.`
                : "Vista consolidada de las cuatro bandejas. Selecciona una bandeja para exportar su CSV."}
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={refresh}
              isLoading={refreshing}
              disabled={loading}
            >
              <ArrowPath /> Actualizar
            </Button>
            {exportType ? (
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => void runExport()}
                isLoading={exporting}
                disabled={exporting}
              >
                <ArrowDownTray /> Exportar CSV
              </Button>
            ) : (
              <Text size="xsmall" className="text-ui-fg-subtle max-w-56">
                Selecciona una bandeja para exportar su CSV.
              </Text>
            )}
          </div>
        </div>

        {actionError && (
          <p role="alert" className="text-ui-fg-error mt-3 text-sm">
            {actionError}
          </p>
        )}
        {listError && (
          <p role="alert" className="text-ui-fg-error mt-3 text-sm">
            {listError}
          </p>
        )}
        {countsError && (
          <p role="status" className="text-ui-fg-subtle mt-3 text-sm">
            {countsError}{" "}
            <Button type="button" size="small" variant="transparent" onClick={() => void loadCounts()}>
              Reintentar contadores
            </Button>
          </p>
        )}
        {notice && (
          <p role="status" className="text-ui-fg-subtle mt-3 text-sm">
            {notice}
          </p>
        )}
      </Container>

      <Container className="p-4 sm:p-6">
        <ContactInboxFilters
          contactType={contactType}
          typeFilter={typeFilter}
          onTypeFilterChange={changeType}
          statusFilter={statusFilter}
          tabCounts={tabCounts}
          onStatusChange={changeStatus}
          searchDraft={searchDraft}
          onSearchDraftChange={setSearchDraft}
          dateFromDraft={dateFromDraft}
          onDateFromChange={setDateFromDraft}
          dateToDraft={dateToDraft}
          onDateToChange={setDateToDraft}
          limit={limit}
          onLimitChange={changeLimit}
          filterError={filterError}
          onSubmit={applyFilters}
          onReset={resetFilters}
        />
      </Container>

      <Container className="p-4 sm:p-6">
        {newIds.size > 0 && (
          <div
            role="status"
            className="border-ui-border-base bg-ui-bg-subtle mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <span className="text-ui-fg-base">
              {newIds.size} {newIds.size === 1 ? "solicitud nueva detectada" : "solicitudes nuevas detectadas"}
            </span>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() => setNewIds(new Set())}
            >
              Descartar aviso
            </Button>
          </div>
        )}

        <p className="text-ui-fg-subtle mb-2 text-xs sm:hidden">
          Desliza horizontalmente para ver todas las columnas.
        </p>

        <ContactTable
          contacts={contacts}
          loading={loading}
          error={listError}
          emptyTitle={emptyState.title}
          emptyDescription={emptyState.description}
          tableLabel={`Solicitudes de ${title}`}
          newIds={newIds}
          busyId={busy?.id ?? null}
          busyAction={busy?.action ?? null}
          onRetry={() => void loadContacts()}
          onShowDetail={(contact, trigger) => void showDetail(contact, trigger)}
          onEdit={(contact) => setEditTarget(contact)}
          onAudit={(contact) => void openAudit(contact)}
          onMarkHandled={(contact) => void markStatus(contact, "handled")}
          onMarkPending={(contact) => void markStatus(contact, "pending")}
          onDelete={(contact) => void deleteContact(contact)}
          onRestore={(contact) => void restoreContact(contact)}
        />

        {total > 0 && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Text size="small" className="text-ui-fg-subtle">
              {total} {total === 1 ? "solicitud" : "solicitudes"} · Página {page} de {totalPages}
            </Text>
            <nav
              aria-label="Paginación de solicitudes"
              className="flex flex-wrap items-center gap-1"
            >
              <Button
                type="button"
                size="small"
                variant="secondary"
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                Anterior
              </Button>
              {paginationItems(page, totalPages).map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} aria-hidden className="text-ui-fg-subtle px-1">
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    type="button"
                    size="small"
                    variant={item === page ? "primary" : "secondary"}
                    aria-label={`Página ${item}`}
                    aria-current={item === page ? "page" : undefined}
                    onClick={() => changePage(item)}
                  >
                    {item}
                  </Button>
                ),
              )}
              <Button
                type="button"
                size="small"
                variant="secondary"
                aria-label="Página siguiente"
                disabled={page >= totalPages}
                onClick={() => changePage(page + 1)}
              >
                Siguiente
              </Button>
            </nav>
          </div>
        )}
      </Container>

      {detail && (
        <ContactDetailDialog
          contact={detail}
          audit={detailAudit}
          notes={notes}
          loading={detailLoading}
          auditLoading={detailLoading}
          error={detailError}
          savingNotes={savingNotes}
          statusBusy={busy?.id === detail.id && busy.action === "status"}
          deleteBusy={busy?.id === detail.id && busy.action === "delete"}
          restoreBusy={busy?.id === detail.id && busy.action === "restore"}
          onNotesChange={setNotes}
          onSaveNotes={() => void saveNotes()}
          onClose={closeDetail}
          onEdit={editFromDetail}
          onMarkHandled={() => void markStatus(detail, "handled")}
          onMarkPending={() => void markStatus(detail, "pending")}
          onDelete={() => void deleteContact(detail)}
          onRestore={() => void restoreContact(detail)}
        />
      )}

      {editTarget && (
        <ContactEditDialog
          key={editTarget.id}
          contact={editTarget}
          saving={savingEdit}
          onClose={closeEdit}
          onSave={saveEdit}
        />
      )}

      {auditTarget && (
        <ContactAuditDialog
          contact={auditTarget}
          audit={auditLogs}
          loading={auditLoading}
          error={auditError}
          onClose={closeAudit}
        />
      )}
    </div>
  )
}
