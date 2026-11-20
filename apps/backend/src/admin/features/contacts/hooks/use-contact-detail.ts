import { useRef, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { contactsApi } from "../api/contacts-api"
import type { Contact, ContactAuditLog } from "../components/inbox"

type DetailOptions = {
  /** Aviso de éxito; la pantalla decide cómo mostrarlo. */
  onSaved: (message: string) => void
}

/**
 * Detalle de una solicitud: carga conjunta de contacto y auditoría, notas
 * internas y sincronización tras un cambio de estado. Cada apertura invalida la
 * anterior para que una respuesta lenta no sobrescriba otro contacto.
 */
export function useContactDetail({ onSaved }: DetailOptions) {
  const [detail, setDetail] = useState<Contact | null>(null)
  const [audit, setAudit] = useState<ContactAuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const requestRef = useRef(0)

  const open = async (contact: Contact) => {
    const requestId = ++requestRef.current
    setDetail(contact)
    setNotes(contact.admin_notes ?? "")
    setAudit([])
    setError(null)
    setLoading(true)
    setSavingNotes(false)

    try {
      const [contactResult, auditResult] = await Promise.all([
        contactsApi.detail(contact.id),
        contactsApi.audit(contact.id),
      ])
      if (requestId !== requestRef.current) return
      setDetail(contactResult.contact)
      setNotes(contactResult.contact.admin_notes ?? "")
      setAudit(auditResult.audit_logs)
    } catch (reason) {
      if (requestId === requestRef.current) {
        setError(errorMessage(reason, "No se pudo abrir la solicitud."))
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }

  const close = () => {
    requestRef.current += 1
    setDetail(null)
    setAudit([])
    setError(null)
    setLoading(false)
    setSavingNotes(false)
    setNotes("")
  }

  /** Refleja un cambio externo (por ejemplo, estado) sin cerrar el diálogo. */
  const sync = (contact: Contact) => {
    if (detail?.id !== contact.id) return
    setDetail(contact)
    setNotes(contact.admin_notes ?? "")
    const requestId = ++requestRef.current
    void contactsApi
      .audit(contact.id)
      .then((result) => {
        if (requestId === requestRef.current) setAudit(result.audit_logs)
      })
      .catch(() => {
        // El cambio ya se guardó; la auditoría se reintenta al reabrir.
      })
  }

  const saveNotes = async () => {
    if (!detail) return
    const id = detail.id
    const requestId = requestRef.current
    setSavingNotes(true)
    setError(null)
    try {
      const result = await contactsApi.update(id, {
        admin_notes: notes.trim() ? notes.trim() : null,
      })
      if (requestId !== requestRef.current) return
      setDetail(result.contact)
      setNotes(result.contact.admin_notes ?? "")
      try {
        const auditResult = await contactsApi.audit(id)
        if (requestId === requestRef.current) setAudit(auditResult.audit_logs)
      } catch {
        // Las notas ya se guardaron; el historial se recupera al reabrir.
      }
      onSaved("Notas internas guardadas.")
    } catch (reason) {
      if (requestId === requestRef.current) {
        setError(errorMessage(reason, "No se pudieron guardar las notas."))
      }
    } finally {
      if (requestId === requestRef.current) setSavingNotes(false)
    }
  }

  return {
    detail,
    audit,
    loading,
    error,
    notes,
    setNotes,
    savingNotes,
    open,
    close,
    sync,
    saveNotes,
  }
}
