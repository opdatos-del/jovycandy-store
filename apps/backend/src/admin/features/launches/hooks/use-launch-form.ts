import { toast } from "@medusajs/ui"
import { useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { createLaunch, launchPayload, updateLaunch } from "../api"
import type { Launch, LaunchDraft } from "../types"

type Options = {
  launches: Launch[]
  reload: () => Promise<void>
}

/**
 * Estado del modal de alta/edición. El orden de un lanzamiento nuevo es la
 * longitud actual de la lista: el servidor normaliza después el orden global.
 */
export function useLaunchForm({ launches, reload }: Options) {
  const [editing, setEditing] = useState<Launch | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formVersion, setFormVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const startNew = () => {
    setEditing(null)
    setFormVersion((version) => version + 1)
    setFormError(null)
    setFormOpen(true)
  }

  const startEditing = (launch: Launch) => {
    setEditing(launch)
    setFormVersion((version) => version + 1)
    setFormError(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setEditing(null)
    setFormError(null)
    setFormVersion((version) => version + 1)
    setFormOpen(false)
  }

  /**
   * Si se elimina el lanzamiento abierto, el modal sigue visible pero pierde la
   * entidad en edición: se remonta como alta para no guardar sobre un id muerto.
   */
  const forgetEditing = (launchId: string) => {
    if (editing?.id !== launchId) return
    setEditing(null)
    setFormVersion((version) => version + 1)
  }

  const saveLaunch = async (draft: LaunchDraft) => {
    setSaving(true)
    setFormError(null)
    try {
      const sortOrder = editing ? editing.sort_order : launches.length
      if (editing) {
        await updateLaunch(editing.id, launchPayload(draft, sortOrder))
      } else {
        await createLaunch(draft, sortOrder)
      }
      toast.success(editing ? "Lanzamiento actualizado." : "Lanzamiento creado.")
      closeForm()
      await reload()
    } catch (error) {
      setFormError(errorMessage(error, "No se pudo guardar el lanzamiento."))
    } finally {
      setSaving(false)
    }
  }

  return {
    editing,
    formOpen,
    formVersion,
    saving,
    formError,
    startNew,
    startEditing,
    closeForm,
    forgetEditing,
    saveLaunch,
  }
}
