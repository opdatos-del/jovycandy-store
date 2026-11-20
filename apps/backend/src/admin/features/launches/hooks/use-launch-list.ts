import { toast, usePrompt } from "@medusajs/ui"
import { useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { removeLaunch, reorderLaunches, updateLaunch } from "../api"
import type { Launch } from "../types"

type Options = {
  launches: Launch[]
  reload: () => Promise<void>
  /** Permite al modal dejar de editar una entidad que ya no existe. */
  onDeleted?: (launchId: string) => void
}

/**
 * Acciones sobre la lista: visibilidad, baja lógica y orden global. Conserva
 * las confirmaciones, los avisos y el bloqueo por elemento del panel histórico.
 */
export function useLaunchList({ launches, reload, onDeleted }: Options) {
  const prompt = usePrompt()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [changingId, setChangingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const toggleActive = async (launch: Launch) => {
    setChangingId(launch.id)
    try {
      await updateLaunch(launch.id, { active: !launch.active })
      toast.success(launch.active ? "Lanzamiento desactivado." : "Lanzamiento activado.")
      await reload()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo cambiar la visibilidad."))
    } finally {
      setChangingId(null)
    }
  }

  const remove = async (launch: Launch) => {
    const confirmed = await prompt({
      title: "Eliminar lanzamiento",
      description: `Eliminarás «${launch.title}». Esta acción no elimina el archivo compartido de la imagen.`,
      confirmText: "Eliminar lanzamiento",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setDeletingId(launch.id)
    try {
      await removeLaunch(launch.id)
      onDeleted?.(launch.id)
      toast.success("Lanzamiento eliminado.")
      await reload()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo eliminar el lanzamiento."))
    } finally {
      setDeletingId(null)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= launches.length) return

    const ids = launches.map((launch) => launch.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]

    setReordering(true)
    try {
      await reorderLaunches(ids)
      toast.success("Orden de lanzamientos actualizado.")
      await reload()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo reordenar los lanzamientos."))
    } finally {
      setReordering(false)
    }
  }

  return { deletingId, changingId, reordering, toggleActive, remove, move }
}
