import { ArrowDownTray, ArrowPath } from "@medusajs/icons"
import { Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { useContactAudit } from "../hooks/use-contact-audit"
import { useContactDetail } from "../hooks/use-contact-detail"
import { useContactExport } from "../hooks/use-contact-export"
import { useContactMutations } from "../hooks/use-contact-mutations"
import { useContactQuery } from "../hooks/use-contact-query"
import { ContactAuditDialog } from "./contact-audit-dialog"
import { ContactDetailDialog } from "./contact-detail-dialog"
import { ContactEditDialog } from "./contact-edit-dialog"
import { ContactInboxFilters } from "./contact-inbox-filters"
import { ContactTable } from "./contact-table"
import {
  CONTACT_PAGE_SIZE,
  CONTACT_POLL_INTERVAL_MS,
  CONTACT_TYPE_LABELS,
  contactName,
  inboxCounts,
  inboxTabCounts,
  normalizeContactLimit,
  paginationItems,
  type Contact,
  type ContactDraft,
  type ContactPageSize,
  type ContactStatus,
  type ContactStatusFilter,
  type ContactType,
} from "./inbox"

type ContactInboxProps = {
  title: string
  description?: string
  /** Fixed inboxes keep the type on the server side; the consolidated view omits it. */
  contactType?: ContactType
}

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

  const [filterError, setFilterError] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Contact | null>(null)

  const lastTriggerRef = useRef<HTMLElement | null>(null)

  const listType = contactType ?? (typeFilter || undefined)
  const exportType = listType ?? null

  const {
    contacts,
    total,
    loading,
    refreshing,
    listError,
    counts,
    countsError,
    newIds,
    setNewIds,
    reload,
    loadCounts,
  } = useContactQuery({
    listType,
    statusFilter,
    search,
    dateFrom,
    dateTo,
    limit,
    page,
    queryVersion,
  })

  const {
    actionError,
    setActionError,
    notice,
    setNotice,
    busy,
    savingEdit,
    setStatus,
    remove,
    restore,
    saveEdit,
  } = useContactMutations({ reload, loadCounts, setNewIds })

  const {
    detail,
    audit: detailAudit,
    loading: detailLoading,
    error: detailError,
    notes,
    setNotes,
    savingNotes,
    open: openDetail,
    close: closeDetail,
    sync: syncDetail,
    saveNotes,
  } = useContactDetail({
    onSaved: (message) => {
      setNotice(message)
      toast.success(message)
    },
  })

  const audit = useContactAudit()

  const { exportingFormat, exportingAll, runExport, runExportAll } = useContactExport({
    exportType,
    typeFilter,
    statusFilter,
    search,
    dateFrom,
    dateTo,
    onStart: () => setActionError(null),
    onNotice: setNotice,
    onError: (message) => {
      setActionError(message)
      toast.error(message)
    },
  })

  const totalPages = Math.max(1, Math.ceil(total / limit))

  useEffect(() => {
    if (page <= totalPages) return
    setPage(totalPages)
  }, [page, totalPages])

  // El sondeo se pausa con la pestaña oculta y se limpia al desmontar. Al volver
  // a estar visible se refresca una vez, sin esperar al siguiente intervalo.
  useEffect(() => {
    const refreshSilently = () => {
      void reload({ silent: true })
      void loadCounts(true)
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return
      refreshSilently()
    }, CONTACT_POLL_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshSilently()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [loadCounts, reload])

  const tabCounts = inboxTabCounts(inboxCounts(counts, listType))

  const refresh = () => {
    setNotice(null)
    void reload({ silent: true, manual: true, force: true })
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
    await openDetail(contact)
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

  const saveEditAndClose = async (draft: ContactDraft) => {
    const id = editTarget?.id
    if (!id) return "No hay una solicitud seleccionada."
    const error = await saveEdit(id, draft)
    if (!error) closeEdit()
    return error
  }

  const markStatus = async (contact: Contact, status: ContactStatus) => {
    const updated = await setStatus(contact, status)
    if (updated) syncDetail(updated)
  }

  const deleteContact = async (contact: Contact) => {
    const confirmed = await prompt({
      title: "Eliminar solicitud",
      description: `La solicitud de ${contactName(contact)} se moverá a la papelera. Podrás restaurarla desde la pestaña Papelera.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    const removed = await remove(contact)
    if (removed && detail?.id === contact.id) closeDetail()
  }

  const restoreContact = async (contact: Contact) => {
    const confirmed = await prompt({
      title: "Restaurar solicitud",
      description: `La solicitud de ${contactName(contact)} volverá a su bandeja con el estado que tenía antes de eliminarse.`,
      confirmText: "Restaurar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    const restored = await restore(contact)
    if (restored && detail?.id === contact.id) closeDetail()
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
                : "Vista consolidada de las cuatro bandejas. Exporta un libro Excel con una hoja por bandeja o filtra por tipo."}
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
              <>
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => void runExport("csv")}
                  isLoading={exportingFormat === "csv"}
                  disabled={exportingFormat !== null || exportingAll}
                >
                  <ArrowDownTray /> Exportar CSV
                </Button>
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => void runExport("xlsx")}
                  isLoading={exportingFormat === "xlsx"}
                  disabled={exportingFormat !== null || exportingAll}
                >
                  <ArrowDownTray /> Exportar Excel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => void runExportAll()}
                isLoading={exportingAll}
                disabled={exportingAll || exportingFormat !== null}
              >
                <ArrowDownTray /> Exportar todo (Excel)
              </Button>
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
          onRetry={() => void reload()}
          onShowDetail={(contact, trigger) => void showDetail(contact, trigger)}
          onEdit={(contact) => setEditTarget(contact)}
          onAudit={(contact) => void audit.open(contact)}
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
          onSave={saveEditAndClose}
        />
      )}

      {audit.target && (
        <ContactAuditDialog
          contact={audit.target}
          audit={audit.logs}
          loading={audit.loading}
          error={audit.error}
          onClose={audit.close}
        />
      )}
    </div>
  )
}
