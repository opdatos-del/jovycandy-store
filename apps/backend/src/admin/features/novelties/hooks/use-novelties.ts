import { toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { moveEventWithinPriority } from "@admin/shared/lib/event-ordering"
import {
  create,
  list,
  remove,
  reorder,
  saveOrder as saveOrderRequest,
  update,
  uploadImage,
  uploadVideo,
} from "../api"
import {
  draftFromEvent,
  draftPayload,
  emptyDraft,
  emptyFilters,
  filterNovelties,
  hasActiveFilters,
  isValidSlug,
  mediaLaneForFile,
  noveltyStoreState,
  publishIssues,
  type NoveltyDraft,
  type NoveltyEvent,
  type NoveltyFilters,
  type NoveltyMediaType,
} from "../model"
import type { EventType, UploadedMedia } from "../types"

const mediaNoun = (type: NoveltyMediaType | null) =>
  type === "video" ? "vídeo" : type === "gif" ? "GIF" : "imagen"

/**
 * Estado y acciones de la bandeja multimedia de Novedades. La entidad es el
 * mismo evento de Eventos Jovy; aquí sólo se administran multimedia, vigencia,
 * orden y visibilidad, conservando las confirmaciones y los mensajes que ya
 * conocía el equipo editorial.
 */
export function useNovelties() {
  const prompt = usePrompt()
  const [events, setEvents] = useState<NoveltyEvent[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sideWarning, setSideWarning] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NoveltyDraft | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [filters, setFilters] = useState<NoveltyFilters>(emptyFilters)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { events: eventsResult, types: typesResult } = await list()

    if (eventsResult.status === "fulfilled") {
      setEvents(eventsResult.value.events)
      setLoadError(null)
    } else {
      setLoadError(errorMessage(eventsResult.reason, "No se pudieron cargar las novedades."))
    }

    if (typesResult.status === "fulfilled") {
      setEventTypes(typesResult.value.event_types)
      setSideWarning(null)
    } else {
      setSideWarning(
        "No se pudieron cargar los tipos de evento. Las novedades existentes se pueden revisar, pero publicar requiere un tipo.",
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Enlace profundo desde Eventos: resalta la tarjeta exacta sin abrir el editor
  // por sorpresa, para que el cambio de pantalla conserve el contexto.
  useEffect(() => {
    if (loading || events.length === 0) return
    const eventId = new URLSearchParams(window.location.search).get("event")
    if (!eventId || highlightedId === eventId) return
    if (!events.some((event) => event.id === eventId)) return

    setHighlightedId(eventId)
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-testid="novelty-card-${eventId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [events, loading, highlightedId])

  const filtered = useMemo(() => filterNovelties(events, filters), [events, filters])
  const filtersActive = hasActiveFilters(filters)

  const storeVisibleCount = events.filter((event) => noveltyStoreState(event).visible).length

  const editingEvent = editingId ? events.find((event) => event.id === editingId) ?? null : null

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setFormError(null)
    setActionError(null)
    setEditorOpen(true)
  }

  const openEditor = (event: NoveltyEvent) => {
    setEditingId(event.id)
    setDraft(draftFromEvent(event))
    setFormError(null)
    setActionError(null)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingId(null)
    setDraft(null)
    setFormError(null)
  }

  const changeDraft = (patch: Partial<NoveltyDraft>) => {
    // Un cambio del usuario invalida el mensaje anterior: mantenerlo visible
    // haría creer que el campo sigue mal aunque ya se haya corregido.
    setFormError(null)
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const updateFilters = (patch: Partial<NoveltyFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
  }

  const clearFilters = () => {
    setFilters(emptyFilters())
  }

  const putEvent = async (event: NoveltyEvent, patch: Record<string, unknown>, successMessage: string) => {
    setBusyId(event.id)
    setActionError(null)
    try {
      await update(event.id, patch)
      toast.success(successMessage)
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo actualizar la novedad.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const publish = async (event: NoveltyEvent) => {
    const issues = publishIssues(event)
    if (issues.length > 0) {
      setActionError(`No se puede publicar “${event.title}”: falta ${issues.join(", ")}.`)
      openEditor(event)
      return
    }

    const confirmed = await prompt({
      title: "Publicar novedad",
      description: `“${event.title}” pasará a Store si su ventana está vigente, está activa y tiene multimedia.`,
      confirmText: "Publicar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    await putEvent(event, { status: "published" }, "Novedad publicada.")
  }

  const archive = async (event: NoveltyEvent) => {
    const confirmed = await prompt({
      title: "Archivar novedad",
      description: `“${event.title}” dejará de mostrarse en el carrusel de Store y quedará como archivada.`,
      confirmText: "Archivar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    await putEvent(event, { status: "archived" }, "Novedad archivada.")
  }

  const toggleEnabled = async (event: NoveltyEvent) => {
    if (event.enabled) {
      const confirmed = await prompt({
        title: "Desactivar novedad",
        description: `“${event.title}” seguirá publicada, pero dejará de mostrarse en Store mientras esté inactiva.`,
        confirmText: "Desactivar",
        cancelText: "Cancelar",
      })
      if (!confirmed) return
    }
    await putEvent(
      event,
      { enabled: !event.enabled },
      event.enabled ? "Novedad desactivada; ya no se muestra en Store." : "Novedad activada.",
    )
  }

  const removeMedia = async (event: NoveltyEvent) => {
    const confirmed = await prompt({
      title: "Retirar multimedia",
      description: `“${event.title}” dejará de aparecer en el carrusel. El archivo permanece en el almacenamiento compartido y puede volver a asociarse.`,
      confirmText: "Retirar medio",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    await putEvent(event, { media_file_id: null }, "Multimedia retirada de la novedad.")
  }

  const deleteEvent = async (event: NoveltyEvent) => {
    const confirmed = await prompt({
      title: "Eliminar novedad",
      description: `Se eliminará “${event.title}”. El archivo multimedia no se borra del almacenamiento, pero la novedad y su vínculo desaparecen.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return

    setBusyId(event.id)
    setActionError(null)
    try {
      await remove(event.id)
      if (editingId === event.id) closeEditor()
      toast.success("Novedad eliminada.")
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo eliminar la novedad.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const saveOrder = async (event: NoveltyEvent, order: { priority: number; sort_order: number }) => {
    await putEvent(event, order, "Prioridad y orden actualizados.")
  }

  const move = async (event: NoveltyEvent, direction: -1 | 1) => {
    const ordered = moveEventWithinPriority(events, event.id, direction)
    if (ordered === events) return

    setReordering(true)
    setActionError(null)
    try {
      await reorder(ordered.map((item) => item.id))
      toast.success("Orden actualizado dentro del mismo grupo de prioridad.")
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo reordenar las novedades.")
      setActionError(message)
      toast.error(message)
    } finally {
      setReordering(false)
    }
  }

  const uploadMedia = async (file: File): Promise<UploadedMedia> => {
    const lane = mediaLaneForFile(file)
    if (!lane) {
      throw new Error("Solo se aceptan imágenes PNG/JPEG/WebP, GIF o vídeo MP4/WebM.")
    }

    return lane === "image" ? uploadImage(file) : uploadVideo(file)
  }

  const replaceCardMedia = async (event: NoveltyEvent, file: File) => {
    if (event.media_file_id) {
      const confirmed = await prompt({
        title: "Reemplazar multimedia",
        description: `“${event.title}” ya tiene ${mediaNoun(event.media_type)}. El archivo anterior permanece en el almacenamiento y la novedad usará el nuevo.`,
        confirmText: "Reemplazar",
        cancelText: "Cancelar",
      })
      if (!confirmed) return
    }

    setBusyId(event.id)
    setActionError(null)
    try {
      const uploaded = await uploadMedia(file)
      await update(event.id, { media_file_id: uploaded.id })
      toast.success(`Multimedia actualizada (${mediaNoun(uploaded.media_type)}).`)
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo subir la multimedia.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const uploadEditorMedia = async (file: File) => {
    if (!draft) return

    if (draft.media_file_id) {
      const confirmed = await prompt({
        title: "Reemplazar multimedia",
        description: "El archivo anterior permanece en el almacenamiento; la novedad usará el nuevo al guardar.",
        confirmText: "Reemplazar",
        cancelText: "Cancelar",
      })
      if (!confirmed) return
    }

    setUploading(true)
    setFormError(null)
    try {
      const uploaded = await uploadMedia(file)
      changeDraft({
        media_file_id: uploaded.id,
        media_url: uploaded.url,
        media_type: uploaded.media_type,
      })
      toast.success("Multimedia cargada. Guarda la novedad para asociarla.")
    } catch (error) {
      const message = errorMessage(error, "No se pudo subir la multimedia.")
      setFormError(message)
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const removeEditorMedia = async () => {
    if (!draft?.media_file_id) return

    const confirmed = await prompt({
      title: "Quitar multimedia",
      description: "La novedad perderá el vínculo con el archivo cuando guardes. El archivo no se borra del almacenamiento.",
      confirmText: "Quitar",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return

    changeDraft({ media_file_id: null, media_url: null, media_type: null })
  }

  const save = async () => {
    if (!draft) return

    if (draft.title.trim().length < 2) {
      setFormError("El título en español debe tener al menos 2 caracteres.")
      return
    }
    if (!isValidSlug(draft.slug)) {
      setFormError("El slug debe usar minúsculas, números y guiones, sin espacios.")
      return
    }

    const issues = draft.status === "published" ? publishIssues(draft) : []
    if (issues.length > 0) {
      setFormError(`No se puede publicar: falta ${issues.join(", ")}.`)
      return
    }

    const current = editingEvent
    const statusChanged = current ? current.status !== draft.status : draft.status !== "draft"
    if (statusChanged && ["published", "archived", "cancelled"].includes(draft.status)) {
      const confirmation =
        draft.status === "published"
          ? {
              title: "Publicar novedad",
              description:
                "La novedad se publicará y aparecerá en el carrusel si su ventana está vigente y tiene multimedia.",
              confirmText: "Publicar",
            }
          : draft.status === "archived"
            ? {
                title: "Archivar novedad",
                description: "La novedad se archivará y dejará de mostrarse en Store.",
                confirmText: "Archivar",
              }
            : {
                title: "Cancelar novedad",
                description: "La novedad quedará cancelada y dejará de mostrarse en Store.",
                confirmText: "Cancelar novedad",
              }
      const confirmed = await prompt({ ...confirmation, cancelText: "Volver" })
      if (!confirmed) return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editingId) {
        await update(editingId, draftPayload(draft))
      } else {
        await create(draft)
      }
      toast.success(editingId ? "Novedad actualizada." : "Novedad creada.")
      closeEditor()
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la novedad.")
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return {
    events,
    eventTypes,
    loading,
    loadError,
    sideWarning,
    actionError,
    busyId,
    reordering,
    uploading,
    saving,
    editorOpen,
    editingId,
    editingEvent,
    draft,
    formError,
    filters,
    highlightedId,
    filtered,
    filtersActive,
    storeVisibleCount,
    load,
    openCreate,
    openEditor,
    closeEditor,
    changeDraft,
    updateFilters,
    clearFilters,
    publish,
    archive,
    toggleEnabled,
    removeMedia,
    deleteEvent,
    saveOrder,
    move,
    replaceCardMedia,
    uploadEditorMedia,
    removeEditorMedia,
    save,
  }
}
