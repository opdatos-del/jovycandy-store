import { Button, Input, Textarea } from "@medusajs/ui"
import { useRef, useState, type FormEvent } from "react"
import { ContactDialog } from "./contact-dialog"
import {
  CONTACT_TYPE_LABELS,
  contactDraftFrom,
  contactName,
  hasContactDraftErrors,
  validateContactDraft,
  type Contact,
  type ContactDraft,
  type ContactDraftErrors,
} from "./inbox"

type ContactEditDialogProps = {
  contact: Contact
  saving: boolean
  onClose: () => void
  onSave: (draft: ContactDraft) => Promise<string | null>
}

type FieldProps = {
  id: keyof ContactDraft
  label: string
  value: string
  type?: string
  required?: boolean
  error?: string
  onChange: (value: string) => void
}

function EditField({ id, label, value, type, required, error, onChange }: FieldProps) {
  const inputId = `contact-edit-${id}`
  const errorId = `${inputId}-error`
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={inputId} className="text-ui-fg-subtle text-xs font-medium">
        {label}
        {required ? " *" : ""}
      </label>
      <Input
        id={inputId}
        type={type}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={errorId} role="alert" className="text-ui-fg-error text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Edición de los datos del solicitante en un modal separado. El tipo de
 * solicitud, el id, el mensaje y el estado operativo se muestran como contexto
 * de solo lectura: el payload solo contiene los campos que acepta el PUT.
 */
export function ContactEditDialog({ contact, saving, onClose, onSave }: ContactEditDialogProps) {
  const [draft, setDraft] = useState<ContactDraft>(() => contactDraftFrom(contact))
  const [errors, setErrors] = useState<ContactDraftErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const update = (field: keyof ContactDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setSaveError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const validation = validateContactDraft(draft)
    setErrors(validation)
    if (hasContactDraftErrors(validation)) {
      setSaveError("Revisa los campos marcados antes de guardar.")
      return
    }

    setSaveError(null)
    const error = await onSave(draft)
    if (error) setSaveError(error)
  }

  return (
    <ContactDialog
      title="Editar solicitud"
      titleId="contact-edit-title"
      description={`Datos de ${contactName(contact)}. El tipo de solicitud y el mensaje original no se modifican.`}
      onClose={onClose}
      width="lg"
      initialFocusRef={firstFieldRef}
      footer={
        <>
          <Button type="button" size="small" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="contact-edit-form"
            size="small"
            isLoading={saving}
            disabled={saving}
          >
            Guardar cambios
          </Button>
        </>
      }
    >
      <form id="contact-edit-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="flex flex-col gap-4">
          <div className="border-ui-border-base bg-ui-bg-subtle rounded-md border p-3 text-sm">
            <p className="text-ui-fg-subtle text-xs font-medium uppercase">Solicitud</p>
            <p className="text-ui-fg-base mt-0.5 font-mono text-xs break-all">#{contact.id}</p>
            <p className="text-ui-fg-subtle mt-1 text-xs">
              {CONTACT_TYPE_LABELS[contact.contact_type]} · Estado: {contact.status === "handled" ? "Atendido" : "Pendiente"}
            </p>
          </div>

          {saveError && (
            <p role="alert" className="text-ui-fg-error text-sm">
              {saveError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditField
              id="first_name"
              label="Nombre"
              value={draft.first_name}
              required
              error={errors.first_name}
              onChange={(value) => update("first_name", value)}
            />
            <EditField
              id="last_name"
              label="Apellido"
              value={draft.last_name}
              error={errors.last_name}
              onChange={(value) => update("last_name", value)}
            />
            <EditField
              id="email"
              label="Email"
              type="email"
              value={draft.email}
              required
              error={errors.email}
              onChange={(value) => update("email", value)}
            />
            <EditField
              id="phone"
              label="Teléfono"
              type="tel"
              value={draft.phone}
              error={errors.phone}
              onChange={(value) => update("phone", value)}
            />
            <EditField
              id="country"
              label="País"
              value={draft.country}
              error={errors.country}
              onChange={(value) => update("country", value)}
            />
            <EditField
              id="city"
              label="Ciudad"
              value={draft.city}
              error={errors.city}
              onChange={(value) => update("city", value)}
            />
            <EditField
              id="postal_code"
              label="Código postal"
              value={draft.postal_code}
              error={errors.postal_code}
              onChange={(value) => update("postal_code", value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-ui-fg-subtle text-xs font-medium">
              Mensaje original (no editable)
            </span>
            <Textarea
              aria-label="Mensaje original no editable"
              value={contact.message}
              readOnly
              rows={4}
              className="bg-ui-bg-subtle"
            />
          </div>
        </div>
      </form>
    </ContactDialog>
  )
}
