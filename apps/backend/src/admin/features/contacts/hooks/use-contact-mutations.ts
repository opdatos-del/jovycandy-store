import { useState, type Dispatch, type SetStateAction } from "react"
import { toast } from "@medusajs/ui"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { contactsApi } from "../api/contacts-api"
import {
  contactUpdatePayload,
  type Contact,
  type ContactDraft,
  type ContactStatus,
} from "../components/inbox"

type BusyAction = "status" | "delete" | "restore"

type Options = {
  reload: (options?: { silent?: boolean; force?: boolean; manual?: boolean }) => Promise<void>
  loadCounts: (silent?: boolean) => Promise<void>
  setNewIds: Dispatch<SetStateAction<Set<string>>>
}

/**
 * Mutaciones de la bandeja: estado, papelera, restauración y edición. Las
 * confirmaciones siguen en la pantalla porque usan el Prompt de Medusa; aquí
 * solo se ejecuta la acción ya confirmada y se refresca la lista.
 */
export function useContactMutations({ reload, loadCounts, setNewIds }: Options) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<{ id: string; action: BusyAction } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  const refresh = () =>
    Promise.all([reload({ silent: true, force: true }), loadCounts(true)])

  const setStatus = async (contact: Contact, status: ContactStatus) => {
    setActionError(null)
    setBusy({ id: contact.id, action: "status" })
    try {
      const result = await contactsApi.update(contact.id, { status })
      const message =
        status === "handled"
          ? "Solicitud marcada como atendida."
          : "Solicitud devuelta a pendientes."
      setNotice(message)
      toast.success(message)
      setNewIds((current) => {
        if (!current.has(contact.id)) return current
        const next = new Set(current)
        next.delete(contact.id)
        return next
      })
      await refresh()
      return result.contact
    } catch (error) {
      const message = errorMessage(error, "No se pudo cambiar el estado de la solicitud.")
      setActionError(message)
      toast.error(message)
      return null
    } finally {
      setBusy(null)
    }
  }

  const remove = async (contact: Contact) => {
    setActionError(null)
    setBusy({ id: contact.id, action: "delete" })
    try {
      await contactsApi.remove(contact.id)
      const message = "Solicitud movida a la papelera."
      setNotice(message)
      toast.success(message)
      await refresh()
      return true
    } catch (error) {
      const message = errorMessage(error, "No se pudo eliminar la solicitud.")
      setActionError(message)
      toast.error(message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const restore = async (contact: Contact) => {
    setActionError(null)
    setBusy({ id: contact.id, action: "restore" })
    try {
      await contactsApi.restore(contact.id)
      const message = "Solicitud restaurada."
      setNotice(message)
      toast.success(message)
      await refresh()
      return true
    } catch (error) {
      const message = errorMessage(error, "No se pudo restaurar la solicitud.")
      setActionError(message)
      toast.error(message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const saveEdit = async (id: string, draft: ContactDraft) => {
    setSavingEdit(true)
    try {
      await contactsApi.update(id, contactUpdatePayload(draft))
      const message = "Solicitud actualizada."
      setNotice(message)
      toast.success(message)
      await refresh()
      return null
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la solicitud.")
      toast.error(message)
      return message
    } finally {
      setSavingEdit(false)
    }
  }

  return {
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
  }
}
