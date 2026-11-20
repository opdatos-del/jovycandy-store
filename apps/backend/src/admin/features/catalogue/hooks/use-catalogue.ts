import { toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import {
  fetchCategories,
  fetchFamilies,
  fetchMedusaCategories,
  reorderCategories,
  seedCategories,
  updateCategory,
  uploadCategoryImage,
} from "../api"
import {
  draftFromCategory,
  effectiveInteractionLocked,
  type CatalogueCategory,
  type CatalogueDraft,
  type CatalogueFamily,
  type MedusaCategory,
} from "../types"

/**
 * Estado y acciones de Categorías del catálogo. Conserva las seis claves fijas,
 * el seed manual, las confirmaciones de estado y el orden que ya conocía la
 * pantalla; no hay alta ni baja de tarjetas.
 */
export function useCatalogue() {
  const prompt = usePrompt()
  const [categories, setCategories] = useState<CatalogueCategory[]>([])
  const [families, setFamilies] = useState<CatalogueFamily[]>([])
  const [medusaCategories, setMedusaCategories] = useState<MedusaCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sideWarning, setSideWarning] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CatalogueDraft | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await fetchCategories())
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, "No se pudieron cargar las categorías del catálogo."))
      setLoading(false)
      return
    }

    const [familyResult, medusaResult] = await Promise.allSettled([
      fetchFamilies(),
      fetchMedusaCategories(),
    ])

    setFamilies(familyResult.status === "fulfilled" ? familyResult.value : [])
    setMedusaCategories(medusaResult.status === "fulfilled" ? medusaResult.value : [])
    setSideWarning(
      familyResult.status === "rejected" || medusaResult.status === "rejected"
        ? "Algunos datos auxiliares no se pudieron cargar; las tarjetas siguen siendo editables."
        : null,
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startEditing = (category: CatalogueCategory) => {
    setEditingId(category.id)
    setDraft(draftFromCategory(category))
    setPreviewUrl(category.image_resolved_url)
    setFormError(null)
    void fetchMedusaCategories()
      .then((result) => setMedusaCategories(result))
      .catch(() => undefined)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setDraft(null)
    setPreviewUrl(null)
    setFormError(null)
  }

  /**
   * Mantiene la combinación que entiende el storefront: Próximamente deja la
   * tarjeta inactiva y bloqueada. Al desmarcarlo se reactiva y se libera la
   * interacción; un bloqueo manual posterior (sin Próximamente) se respeta.
   */
  const changeDraft = (patch: Partial<CatalogueDraft>) => {
    setDraft((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      if (patch.coming_soon === true) {
        next.active = false
        next.interaction_locked = true
      }
      if (patch.coming_soon === false && current.coming_soon) {
        next.active = true
        next.interaction_locked = false
      }
      if (patch.active === true) next.coming_soon = false
      return next
    })
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    setFormError(null)
    try {
      const uploaded = await uploadCategoryImage(file)
      changeDraft({ image_file_id: uploaded.id })
      setPreviewUrl(uploaded.url)
      toast.success("Imagen cargada. Guarda la tarjeta para asociarla.")
    } catch (error) {
      const message = errorMessage(error, "No se pudo cargar la imagen.")
      setFormError(message)
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    changeDraft({ image_file_id: null, image_url: "" })
    setPreviewUrl(null)
  }

  const save = async () => {
    const editingCategory = categories.find((category) => category.id === editingId)
    if (!editingId || !draft || !editingCategory) return
    const name = draft.name.trim()
    if (name.length < 2) {
      setFormError("El nombre debe tener al menos 2 caracteres.")
      return
    }

    const imageUrl = draft.image_url.trim()
    if (imageUrl && !imageUrl.startsWith("https://")) {
      setFormError("La URL de imagen externa debe usar HTTPS.")
      return
    }

    const nextActive = draft.coming_soon ? false : draft.active
    const statusChanged =
      editingCategory.active !== nextActive || editingCategory.coming_soon !== draft.coming_soon
    if (statusChanged) {
      const confirmed = await prompt({
        title: "Confirmar cambio de estado",
        description: draft.coming_soon
          ? "La categoría quedará como Próximamente, inactiva y sin interacción en Store."
          : nextActive
            ? "La categoría volverá a estar activa y con interacción libre en Store."
            : "La categoría quedará inactiva y no se publicará en Store.",
        confirmText: "Guardar cambios",
        cancelText: "Seguir editando",
      })
      if (!confirmed) return
    }

    setSaving(true)
    setFormError(null)
    try {
      await updateCategory(editingId, {
        name,
        description: draft.description.trim() || null,
        active: nextActive,
        coming_soon: draft.coming_soon,
        interaction_locked: effectiveInteractionLocked(draft),
        medusa_category_id: draft.medusa_category_id || null,
        image_file_id: draft.image_file_id,
        image_url: imageUrl || null,
      })
      toast.success("Tarjeta de catálogo guardada.")
      cancelEditing()
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la tarjeta.")
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Alterna Próximamente desde la tarjeta. Aplica la misma regla histórica que
   * el formulario: marcar deja la categoría inactiva y bloqueada; desmarcar la
   * reactiva y libera la interacción. Cancelar la confirmación no muta nada.
   */
  const toggleComingSoon = async (category: CatalogueCategory) => {
    const comingSoon = !category.coming_soon
    const confirmed = await prompt({
      title: comingSoon ? "Marcar como Próximamente" : "Quitar Próximamente",
      description: comingSoon
        ? "La categoría quedará como Próximamente, inactiva y sin interacción en Store."
        : "La categoría volverá a estar activa y con interacción libre en Store.",
      confirmText: "Confirmar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setTogglingId(category.id)
    setToggleError(null)
    try {
      await updateCategory(category.id, {
        coming_soon: comingSoon,
        active: !comingSoon,
        interaction_locked: comingSoon,
      })
      toast.success(
        comingSoon ? "Categoría marcada como Próximamente." : "Categoría reactivada en Store.",
      )
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo cambiar el estado de la categoría.")
      setToggleError(message)
      toast.error(message)
    } finally {
      setTogglingId(null)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= categories.length) return
    const ids = categories.map((category) => category.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    setReordering(true)
    try {
      await reorderCategories(ids)
      toast.success("Orden del catálogo actualizado.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo reordenar el catálogo."))
    } finally {
      setReordering(false)
    }
  }

  const seed = async () => {
    const confirmed = await prompt({
      title: "Crear tarjetas faltantes",
      description: "Solo se crearán tarjetas faltantes con sus valores iniciales. Nunca se sobrescriben tarjetas existentes.",
      confirmText: "Sembrar tarjetas",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    setSeeding(true)
    try {
      const result = await seedCategories()
      toast.success(
        result.created === 0
          ? "Las seis tarjetas ya existían; no se modificó ninguna."
          : `${result.created} ${result.created === 1 ? "tarjeta creada" : "tarjetas creadas"}.`,
      )
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo ejecutar el seed."))
    } finally {
      setSeeding(false)
    }
  }

  const editingCategory = categories.find((category) => category.id === editingId)

  return {
    categories,
    families,
    medusaCategories,
    loading,
    loadError,
    sideWarning,
    formError,
    editingCategory,
    draft,
    previewUrl,
    saving,
    uploading,
    reordering,
    seeding,
    togglingId,
    toggleError,
    load,
    startEditing,
    cancelEditing,
    changeDraft,
    uploadImage,
    removeImage,
    save,
    toggleComingSoon,
    move,
    seed,
  }
}
