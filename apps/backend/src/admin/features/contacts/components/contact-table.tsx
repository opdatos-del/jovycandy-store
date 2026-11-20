import {
  ArrowUturnLeft,
  Check,
  Eye,
  InformationCircle,
  PencilSquare,
  Trash,
  XMark,
} from "@medusajs/icons"
import { Badge, Button } from "@medusajs/ui"
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"
import {
  contactName,
  contactStatusLabel,
  formatDateParts,
  isContactDeleted,
  locationText,
  previewMessage,
  type Contact,
} from "./inbox"

type BusyAction = "status" | "delete" | "restore" | null

type ContactTableProps = {
  contacts: Contact[]
  loading: boolean
  error: string | null
  emptyTitle: string
  emptyDescription: string
  tableLabel: string
  newIds: ReadonlySet<string>
  busyId: string | null
  busyAction: BusyAction
  can: (contact: Contact, operation: "read" | "update" | "delete" | "restore") => boolean
  onRetry: () => void
  onShowDetail: (contact: Contact, trigger: HTMLButtonElement) => void
  onEdit: (contact: Contact) => void
  onAudit: (contact: Contact) => void
  onMarkHandled: (contact: Contact) => void
  onMarkPending: (contact: Contact) => void
  onDelete: (contact: Contact) => void
  onRestore: (contact: Contact) => void
}

function RowAction({
  label,
  title,
  onClick,
  busy,
  disabled,
  children,
}: {
  label: string
  title: string
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
  busy?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="small"
      variant="transparent"
      aria-label={label}
      title={title}
      isLoading={busy}
      disabled={disabled}
      onClick={onClick}
      className="jovy-icon-button text-ui-fg-subtle hover:text-ui-fg-base focus-visible:ring-ui-border-interactive h-8 w-8 p-0 focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </Button>
  )
}

/**
 * Tabla compartida por las cuatro bandejas y la vista consolidada. Conserva
 * todas las columnas históricas y desplaza en horizontal en pantallas
 * estrechas en lugar de convertirlas en tarjetas.
 */
export function ContactTable({
  contacts,
  loading,
  error,
  emptyTitle,
  emptyDescription,
  tableLabel,
  newIds,
  busyId,
  busyAction,
  can,
  onRetry,
  onShowDetail,
  onEdit,
  onAudit,
  onMarkHandled,
  onMarkPending,
  onDelete,
  onRestore,
}: ContactTableProps) {
  return (
    <div
      className="jovy-scroll overflow-x-auto"
      data-testid="contacts-table-scroll"
      role="region"
      tabIndex={0}
      aria-label="Tabla de solicitudes, desplazable horizontalmente"
    >
      <table
        className="w-full min-w-[1100px] table-fixed text-left text-sm"
        aria-label={tableLabel}
        aria-busy={loading}
      >
        <colgroup>
          <col style={{ width: 140 }} />
          <col style={{ width: 190 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 160 }} />
          <col />
          <col style={{ width: 190 }} />
        </colgroup>
        <thead className="text-ui-fg-subtle">
          <tr className="border-ui-border-base border-b">
            <th scope="col" className="py-2 pr-3 font-medium">
              Fecha
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Cliente
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Contacto
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Ubicación
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Mensaje
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-ui-border-base divide-y">
          {contacts.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-10 text-center">
                {loading ? (
                  <p role="status" className="text-ui-fg-subtle">
                    Cargando solicitudes…
                  </p>
                ) : error ? (
                  <div className="flex flex-col items-center gap-2">
                    <p role="alert" className="text-ui-fg-error">
                      {error}
                    </p>
                    <Button type="button" size="small" variant="secondary" onClick={onRetry}>
                      Reintentar
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-ui-fg-base font-medium">{emptyTitle}</p>
                    <p className="text-ui-fg-subtle text-sm">{emptyDescription}</p>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            contacts.map((contact) => {
              const deleted = isContactDeleted(contact)
              const isNew = newIds.has(contact.id)
              const date = formatDateParts(contact.created_at)
              const busy = busyId === contact.id
              const canUpdate = can(contact, "update")
              const canDelete = can(contact, "delete")
              const canRestore = can(contact, "restore")
              const canRead = can(contact, "read")
              return (
                <tr
                  key={contact.id}
                  data-testid={`contact-row-${contact.id}`}
                  className={[
                    "align-top",
                    deleted ? "bg-ui-bg-subtle/60 [&>td]:line-through" : "",
                    !deleted && contact.status === "handled" ? "bg-ui-bg-subtle/40" : "",
                    isNew ? "border-l-ui-tag-green-icon border-l-4" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td className="py-3 pr-3 whitespace-nowrap">
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="text-ui-fg-base font-semibold">{date?.date ?? "—"}</p>
                        <p className="text-ui-fg-subtle text-xs">{date?.time ?? ""}</p>
                      </div>
                      {isNew && (
                        <span
                          className="bg-ui-tag-green-icon mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                          aria-label="Solicitud nueva"
                          title="Solicitud nueva"
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="text-ui-fg-base font-medium break-words">{contactName(contact)}</p>
                    <Badge
                      color={deleted ? "red" : contact.status === "handled" ? "green" : "orange"}
                      size="xsmall"
                      className="mt-1"
                    >
                      {contactStatusLabel(contact)}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="text-ui-fg-base break-words">{contact.email}</p>
                    <p className="text-ui-fg-subtle text-xs break-words">{contact.phone || "—"}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="text-ui-fg-base break-words">
                      {[contact.city, contact.country].filter(Boolean).join(", ") || "—"}
                    </p>
                    <p className="text-ui-fg-subtle text-xs">
                      {contact.postal_code ? `CP ${contact.postal_code}` : "Sin CP"}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="text-ui-fg-base break-words whitespace-normal">
                      {previewMessage(contact.message)}
                    </p>
                    {contact.message.length > 100 && (
                      <p className="text-ui-fg-subtle mt-1 text-xs">Ver detalle para el mensaje completo.</p>
                    )}
                  </td>
                  <td className="py-3 no-underline">
                    <div className="flex flex-wrap items-center justify-end gap-0.5">
                      {deleted ? (
                        <>
                          {canRead && (
                            <RowAction
                              label="Ver más"
                              title={`Ver detalle de ${contactName(contact)}`}
                              onClick={(event) => onShowDetail(contact, event.currentTarget)}
                            >
                              <Eye />
                            </RowAction>
                          )}
                          {canRead && (
                            <RowAction
                              label="Auditoría"
                              title={`Ver auditoría de ${contactName(contact)}`}
                              onClick={() => onAudit(contact)}
                            >
                              <InformationCircle />
                            </RowAction>
                          )}
                          {canRestore && (
                            <RowAction
                              label="Restaurar"
                              title={`Restaurar ${contactName(contact)}`}
                              onClick={() => onRestore(contact)}
                              busy={busy && busyAction === "restore"}
                              disabled={busy}
                            >
                              <ArrowUturnLeft />
                            </RowAction>
                          )}
                        </>
                      ) : (
                        <>
                          {canUpdate && (
                            <RowAction
                              label={contact.status === "handled" ? "Marcar pendiente" : "Marcar atendido"}
                              title={
                                contact.status === "handled"
                                  ? `Volver pendiente: ${contactName(contact)}`
                                  : `Marcar atendido: ${contactName(contact)}`
                              }
                              onClick={() =>
                                contact.status === "handled"
                                  ? onMarkPending(contact)
                                  : onMarkHandled(contact)
                              }
                              busy={busy && busyAction === "status"}
                              disabled={busy}
                            >
                              {contact.status === "handled" ? <XMark /> : <Check />}
                            </RowAction>
                          )}
                          {canRead && (
                            <RowAction
                              label="Ver más"
                              title={`Ver detalle de ${contactName(contact)}`}
                              onClick={(event) => onShowDetail(contact, event.currentTarget)}
                            >
                              <Eye />
                            </RowAction>
                          )}
                          {canUpdate && (
                            <RowAction
                              label="Editar"
                              title={`Editar ${contactName(contact)}`}
                              onClick={() => onEdit(contact)}
                              disabled={busy}
                            >
                              <PencilSquare />
                            </RowAction>
                          )}
                          {canRead && (
                            <RowAction
                              label="Auditoría"
                              title={`Ver auditoría de ${contactName(contact)}`}
                              onClick={() => onAudit(contact)}
                            >
                              <InformationCircle />
                            </RowAction>
                          )}
                          {canDelete && (
                            <RowAction
                              label="Eliminar"
                              title={`Enviar a papelera: ${contactName(contact)}`}
                              onClick={() => onDelete(contact)}
                              busy={busy && busyAction === "delete"}
                              disabled={busy}
                            >
                              <Trash />
                            </RowAction>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
