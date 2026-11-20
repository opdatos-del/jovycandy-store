import { ArrowUturnLeft, Check, PencilSquare, Trash, XMark } from "@medusajs/icons"
import { Badge, Button, Textarea } from "@medusajs/ui"
import { ContactDialog } from "./contact-dialog"
import {
  CONTACT_AUDIT_LABELS,
  CONTACT_TYPE_LABELS,
  contactName,
  contactStatusLabel,
  formatDateTime,
  isContactDeleted,
  type Contact,
  type ContactAuditLog,
} from "./inbox"

type ContactDetailDialogProps = {
  contact: Contact
  audit: ContactAuditLog[]
  notes: string
  loading: boolean
  auditLoading: boolean
  error: string | null
  savingNotes: boolean
  statusBusy: boolean
  deleteBusy: boolean
  restoreBusy: boolean
  canUpdate: boolean
  canDelete: boolean
  canRestore: boolean
  onNotesChange: (value: string) => void
  onSaveNotes: () => void
  onClose: () => void
  onEdit: () => void
  onMarkHandled: () => void
  onMarkPending: () => void
  onDelete: () => void
  onRestore: () => void
}

function statusColor(contact: Contact) {
  if (isContactDeleted(contact)) return "red" as const
  return contact.status === "handled" ? ("green" as const) : ("orange" as const)
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ui-fg-subtle text-xs font-medium uppercase">{label}</dt>
      <dd className="text-ui-fg-base mt-0.5 break-words text-sm">{value}</dd>
    </div>
  )
}

/**
 * Detalle completo en modal. La fila abre este diálogo en lugar de expandir la
 * tabla; las acciones operativas viven aquí y en la columna Acciones, con las
 * mismas reglas: la papelera solo permite restaurar.
 */
export function ContactDetailDialog({
  contact,
  audit,
  notes,
  loading,
  auditLoading,
  error,
  savingNotes,
  statusBusy,
  deleteBusy,
  restoreBusy,
  canUpdate,
  canDelete,
  canRestore,
  onNotesChange,
  onSaveNotes,
  onClose,
  onEdit,
  onMarkHandled,
  onMarkPending,
  onDelete,
  onRestore,
}: ContactDetailDialogProps) {
  const deleted = isContactDeleted(contact)
  const name = contactName(contact)
  const notesChanged = notes.trim() !== (contact.admin_notes ?? "").trim()
  const busy = statusBusy || deleteBusy || restoreBusy

  return (
    <ContactDialog
      title={`Solicitud de ${name}`}
      titleId="contact-detail-title"
      description="Detalle completo y acciones de seguimiento."
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button type="button" size="small" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {deleted ? (
            canRestore && (
              <Button
                type="button"
                size="small"
                onClick={onRestore}
                isLoading={restoreBusy}
                disabled={busy}
              >
                <ArrowUturnLeft /> Restaurar
              </Button>
            )
          ) : (
            <>
              {canUpdate && (
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={contact.status === "handled" ? onMarkPending : onMarkHandled}
                  isLoading={statusBusy}
                  disabled={busy}
                >
                  {contact.status === "handled" ? <XMark /> : <Check />}
                  {contact.status === "handled" ? "Volver pendiente" : "Marcar atendido"}
                </Button>
              )}
              {canUpdate && (
                <Button type="button" size="small" variant="secondary" onClick={onEdit} disabled={busy}>
                  <PencilSquare /> Editar
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  size="small"
                  variant="danger"
                  onClick={onDelete}
                  isLoading={deleteBusy}
                  disabled={busy}
                >
                  <Trash /> Eliminar
                </Button>
              )}
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ui-fg-subtle text-xs font-medium uppercase">Solicitud</p>
            <p className="text-ui-fg-base mt-0.5 font-mono text-sm break-all">#{contact.id}</p>
            <p className="text-ui-fg-subtle mt-1 text-xs">
              {CONTACT_TYPE_LABELS[contact.contact_type]}
            </p>
          </div>
          <Badge color={statusColor(contact)} size="base">
            {contactStatusLabel(contact)}
          </Badge>
        </div>

        {loading && (
          <p role="status" className="text-ui-fg-subtle text-sm">
            Cargando detalle…
          </p>
        )}
        {error && (
          <p role="alert" className="text-ui-fg-error text-sm">
            {error}
          </p>
        )}

        <section aria-labelledby="contact-detail-customer">
          <h3 id="contact-detail-customer" className="text-ui-fg-base text-sm font-semibold">
            Cliente y contacto
          </h3>
          <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cliente" value={name} />
            <Field label="Email" value={contact.email} />
            <Field label="Teléfono" value={contact.phone || "—"} />
            <Field
              label="Ubicación"
              value={
                [contact.city, contact.country].filter(Boolean).join(", ") || "—"
              }
            />
            <Field label="Código postal" value={contact.postal_code || "—"} />
          </dl>
        </section>

        <section aria-labelledby="contact-detail-message">
          <h3 id="contact-detail-message" className="text-ui-fg-base text-sm font-semibold">
            Mensaje
          </h3>
          <p className="border-ui-border-base bg-ui-bg-subtle text-ui-fg-base mt-2 max-h-80 overflow-y-auto rounded-md border p-3 text-sm break-words whitespace-pre-wrap">
            {contact.message || "—"}
          </p>
        </section>

        <section aria-labelledby="contact-detail-dates">
          <h3 id="contact-detail-dates" className="text-ui-fg-base text-sm font-semibold">
            Fechas
          </h3>
          <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Recibida" value={formatDateTime(contact.created_at)} />
            <Field label="Actualizada" value={formatDateTime(contact.updated_at)} />
            <Field
              label="Atendida"
              value={
                contact.handled_at
                  ? `${formatDateTime(contact.handled_at)}${contact.handled_by ? ` · ${contact.handled_by}` : ""}`
                  : "—"
              }
            />
            <Field label="Eliminada" value={formatDateTime(contact.deleted_at)} />
          </dl>
        </section>

        <section aria-labelledby="contact-detail-notes">
          <h3 id="contact-detail-notes" className="text-ui-fg-base text-sm font-semibold">
            Notas internas
          </h3>
          {deleted || !canUpdate ? (
            <p className="text-ui-fg-subtle mt-2 text-sm break-words whitespace-pre-wrap">
              {contact.admin_notes || "Sin notas internas."}
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <Textarea
                aria-label="Notas internas"
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Seguimiento interno; no se publica en Store."
                rows={3}
                maxLength={4_000}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-ui-fg-subtle text-xs">
                  Solo se guardan las notas y la fecha de actualización.
                </p>
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={onSaveNotes}
                  isLoading={savingNotes}
                  disabled={!notesChanged || savingNotes}
                >
                  Guardar notas
                </Button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="contact-detail-audit">
          <h3 id="contact-detail-audit" className="text-ui-fg-base text-sm font-semibold">
            Auditoría
          </h3>
          <p className="text-ui-fg-subtle mt-1 text-xs">
            Solo acción, fecha y actor. El mensaje y los datos personales no se registran.
          </p>
          {auditLoading ? (
            <p role="status" className="text-ui-fg-subtle mt-2 text-sm">
              Cargando auditoría…
            </p>
          ) : audit.length === 0 ? (
            <p className="text-ui-fg-subtle mt-2 text-sm">Sin eventos de auditoría.</p>
          ) : (
            <ul className="divide-ui-border-base mt-2 divide-y text-sm">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="text-ui-fg-base">{CONTACT_AUDIT_LABELS[entry.action]}</span>
                  <span className="text-ui-fg-subtle text-xs">
                    {formatDateTime(entry.created_at)}
                    {entry.actor_id ? ` · ${entry.actor_id}` : " · sistema"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ContactDialog>
  )
}
