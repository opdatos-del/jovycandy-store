import { useRef, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { contactsApi } from "../api/contacts-api"
import type { Contact, ContactAuditLog } from "../components/inbox"

/**
 * Auditoría abierta desde la tabla. Cada apertura invalida la anterior para que
 * una respuesta lenta no sobrescriba el historial de otro contacto.
 */
export function useContactAudit() {
  const [target, setTarget] = useState<Contact | null>(null)
  const [logs, setLogs] = useState<ContactAuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const open = async (contact: Contact) => {
    const requestId = ++requestRef.current
    setTarget(contact)
    setLogs([])
    setError(null)
    setLoading(true)
    try {
      const result = await contactsApi.audit(contact.id)
      if (requestId !== requestRef.current) return
      setLogs(result.audit_logs)
    } catch (reason) {
      if (requestId !== requestRef.current) return
      setError(errorMessage(reason, "No se pudo cargar la auditoría."))
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }

  const close = () => {
    requestRef.current += 1
    setTarget(null)
    setLogs([])
    setError(null)
    setLoading(false)
  }

  return { target, logs, loading, error, open, close }
}
