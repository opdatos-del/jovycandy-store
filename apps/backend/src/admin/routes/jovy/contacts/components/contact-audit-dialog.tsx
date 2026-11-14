import { Button } from "@medusajs/ui"
import { ContactDialog } from "./contact-dialog"
import {
  CONTACT_AUDIT_LABELS,
  contactName,
  formatDateTime,
  type Contact,
  type ContactAuditLog,
} from "./inbox"

type ContactAuditDialogProps = {
  contact: Contact
  audit: ContactAuditLog[]
  loading: boolean
  error: string | null
  onClose: () => void
}

/**
 * Auditoría aislada de una solicitud. El backend solo expone acción, fecha y
 * actor; el contenido del mensaje y los datos personales nunca llegan aquí.
 */
export function ContactAuditDialog({
  contact,
  audit,
  loading,
  error,
  onClose,
}: ContactAuditDialogProps) {
  return (
    <ContactDialog
      title="Auditoría de la solicitud"
      titleId="contact-audit-title"
      description={`${contactName(contact)} · #${contact.id}`}
      onClose={onClose}
      width="md"
      footer={
        <Button type="button" size="small" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {loading ? (
          <p role="status" className="text-ui-fg-subtle text-sm">
            Cargando auditoría…
          </p>
        ) : error ? (
          <p role="alert" className="text-ui-fg-error text-sm">
            {error}
          </p>
        ) : audit.length === 0 ? (
          <p className="text-ui-fg-subtle text-sm">Sin eventos de auditoría.</p>
        ) : (
          <ul className="divide-ui-border-base divide-y text-sm">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="text-ui-fg-base font-medium">
                  {CONTACT_AUDIT_LABELS[entry.action]}
                </span>
                <span className="text-ui-fg-subtle text-xs">
                  {formatDateTime(entry.created_at)}
                  {entry.actor_id ? ` · ${entry.actor_id}` : " · sistema"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-ui-fg-subtle text-xs">
          Los cambios de datos no copian el mensaje ni los campos personales al historial.
        </p>
      </div>
    </ContactDialog>
  )
}
