import { toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import {
  deleteEditorial,
  listEditorial,
  payloadFromDraft,
  restoreEditorial,
  saveEditorial,
} from "../api"
import { draftFrom, emptyDraft, parseSortOrder, SORT_ORDER_ERROR } from "../model"
import type { CommercialMode, EditorialDraft, EditorialStatus, ProductEditorial } from "../types"

/**
 * Estado y acciones de la ficha editorial de un producto. Conserva las
 * confirmaciones, los mensajes y el hecho de no tocar el producto comercial
 * nativo: aquí solo se administra presentación y ciclo editorial.
 */
export function useProductEditorial(productId: string) {
  const prompt = usePrompt()
  const [editorial, setEditorial] = useState<ProductEditorial | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [draft, setDraft] = useState<EditorialDraft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [record] = await listEditorial(productId)

      if (!record) {
        setEditorial(null)
        setDeleted(false)
        setDraft(emptyDraft())
      } else {
        const { deleted: isDeleted, ...editorialRecord } = record
        setEditorial(editorialRecord)
        setDeleted(isDeleted)
        setDraft(draftFrom(editorialRecord))
      }
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, "No se pudo cargar la ficha editorial."))
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void load()
  }, [load])

  const update = (patch: Partial<EditorialDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const toggleCertification = (certification: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      certifications: checked
        ? [...current.certifications, certification]
        : current.certifications.filter((value) => value !== certification),
    }))
  }

  /** Pasar a vendible exige confirmación; nunca se inventan precios ni stock. */
  const changeCommercialMode = async (mode: CommercialMode) => {
    if (mode === draft.commercial_mode) return
    if (mode === "sellable") {
      const confirmed = await prompt({
        title: "Marcar producto como vendible",
        description:
          "Al marcarlo como vendible no se inventan precios ni stock y no se modifica el producto comercial nativo. La venta real requiere cumplir los requisitos comerciales y superar las validaciones del servidor; esta acción solo registra la intención comercial.",
        confirmText: "Marcar como vendible",
        cancelText: "Cancelar",
      })
      if (!confirmed) {
        // Fuerza el render para que el <select> controlado vuelva al valor confirmado.
        update({})
        return
      }
    }
    update({ commercial_mode: mode })
  }

  const persist = async (overrides: Partial<EditorialDraft> = {}) => {
    const next = { ...draft, ...overrides }
    const sortOrder = parseSortOrder(next.sort_order)

    if (sortOrder === null) {
      setFormError(SORT_ORDER_ERROR)
      return false
    }

    setSaving(true)
    setFormError(null)
    try {
      const result = await saveEditorial(productId, payloadFromDraft(next, sortOrder))
      setEditorial(result.editorial)
      setDeleted(result.deleted)
      setDraft(draftFrom(result.editorial))
      toast.success(
        next.editorial_status === "published"
          ? "Producto publicado en el catálogo editorial."
          : next.editorial_status === "archived"
            ? "Ficha editorial archivada."
            : "Ficha editorial guardada.",
      )
      return true
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la ficha editorial.")
      setFormError(message)
      toast.error(message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    if (parseSortOrder(draft.sort_order) === null) {
      setFormError(SORT_ORDER_ERROR)
      return
    }

    const confirmed = await prompt({
      title: editorial ? "Guardar cambios editoriales" : "Crear ficha editorial",
      description: editorial
        ? "Se guardarán los cambios de presentación y estado editorial. SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican."
        : "Se creará una ficha editorial en borrador. SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican.",
      confirmText: editorial ? "Guardar cambios" : "Guardar ficha",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    await persist()
  }

  const transition = async (status: EditorialStatus) => {
    const confirmed = await prompt({
      title: status === "published" ? "Publicar en Store" : "Archivar ficha editorial",
      description:
        status === "published"
          ? "La ficha quedará disponible para Store si el producto comercial también cumple sus requisitos."
          : "La ficha dejará de aparecer en Store. El producto comercial y sus datos no se modifican.",
      confirmText: status === "published" ? "Publicar en Store" : "Archivar ficha",
      cancelText: "Seguir editando",
    })
    if (!confirmed) return
    await persist({ editorial_status: status })
  }

  const restoreArchived = async () => {
    const confirmed = await prompt({
      title: "Restaurar a borrador",
      description:
        "La ficha editorial volverá a borrador y dejará de aparecer en Store. SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican.",
      confirmText: "Restaurar a borrador",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    await persist({ editorial_status: "draft" })
  }

  const remove = async () => {
    const confirmed = await prompt({
      title: "Eliminar ficha editorial",
      description:
        "Se eliminará solo esta ficha editorial. El producto comercial no se borra y podrás restaurar la ficha.",
      confirmText: "Eliminar ficha",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setSaving(true)
    try {
      await deleteEditorial(productId)
      toast.success("Ficha editorial eliminada. Puedes restaurarla.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo eliminar la ficha editorial."))
    } finally {
      setSaving(false)
    }
  }

  const restoreDeleted = async () => {
    const confirmed = await prompt({
      title: "Restaurar ficha editorial",
      description:
        "La ficha editorial eliminada se restaurará con sus datos anteriores. SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican.",
      confirmText: "Restaurar ficha",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setSaving(true)
    try {
      await restoreEditorial(productId)
      toast.success("Ficha editorial restaurada como estaba antes de eliminarla.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo restaurar la ficha editorial."))
    } finally {
      setSaving(false)
    }
  }

  return {
    editorial,
    deleted,
    draft,
    loading,
    loadError,
    formError,
    saving,
    reload: load,
    update,
    toggleCertification,
    changeCommercialMode,
    save,
    publish: () => transition("published"),
    archive: () => transition("archived"),
    restoreArchived,
    remove,
    restoreDeleted,
  }
}

export type ProductEditorialController = ReturnType<typeof useProductEditorial>
