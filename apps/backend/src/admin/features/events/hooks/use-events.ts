import { usePrompt } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { moveEventWithinPriority } from "@admin/shared/lib/event-ordering"
import {
  createEvent,
  createEventType,
  deleteEvent,
  deleteEventType,
  fetchEvents,
  fetchEventTypes,
  fetchMediaUrl,
  reorderEvents,
  updateEvent,
  updateEventType,
  uploadEventImage,
} from "../api"
import {
  editableEvent,
  emptyEvent,
  emptyType,
  isVideoMedia,
  type Event,
  type EventForm,
  type EventType,
  type Status,
  type TypeForm,
} from "../types"

/**
 * Estado y acciones de la agenda. Conserva los textos de confirmación, el
 * bloqueo mientras hay operaciones en curso y el enlace profundo desde
 * Novedades (`?event=`) que abre el evento exacto en el formulario.
 */
export function useEvents() {
  const prompt = usePrompt()
  const [events, setEvents] = useState<Event[]>([])
  const [types, setTypes] = useState<EventType[]>([])
  const [form, setForm] = useState<EventForm>(emptyEvent())
  const [typeForm, setTypeForm] = useState<TypeForm>(emptyType())
  const [editing, setEditing] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null)
  // Evita reabrir el editor en cada recarga si el enlace profundo ya se atendió.
  const deepLinkRef = useRef<string | null>(null)

  const load = async () => {
    try {
      const [eventList, typeList] = await Promise.all([fetchEvents(), fetchEventTypes()])
      setEvents(eventList)
      setTypes(typeList)
    } catch (error) {
      setMessage(errorMessage(error, "No se pudieron cargar los eventos."))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Enlace profundo desde Novedades: abre el evento exacto en el formulario en
  // lugar de dejar a la persona usuaria buscándolo manualmente en la agenda.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("event")
    if (!requested || events.length === 0 || deepLinkRef.current === requested) return
    const target = events.find((event) => event.id === requested)
    if (!target) return
    deepLinkRef.current = requested
    void edit(target)
  }, [events])

  const reset = () => {
    setEditing(null)
    setForm(emptyEvent())
    setPreviewUrl(null)
  }

  const resetType = () => setTypeForm(emptyType())

  const upload = async (file?: File) => {
    if (!file) return
    setSaving(true)
    try {
      const result = await uploadEventImage(file)
      setForm((current) => ({ ...current, media_file_id: result.id }))
      setPreviewUrl(result.url)
      setMessage("Imagen cargada y lista para guardar.")
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo cargar el archivo."))
    } finally {
      setSaving(false)
    }
  }

  const edit = async (event: Event) => {
    setEditing(event.id)
    setTypeForm(emptyType())
    setForm(event)
    setPreviewUrl(null)
    requestAnimationFrame(() => {
      document.getElementById("event-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })
      document.getElementById("event-title-input")?.focus({ preventScroll: true })
    })
    if (!event.media_file_id) return
    try {
      setPreviewUrl(await fetchMediaUrl(event.media_file_id))
    } catch {
      setMessage("El archivo asociado ya no está disponible.")
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await updateEvent(editing, editableEvent(form))
      } else {
        await createEvent(editableEvent(form))
      }
      setMessage("Evento guardado.")
      reset()
      await load()
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo guardar el evento."))
    } finally {
      setSaving(false)
    }
  }

  const patch = async (event: Event, status: Status) => {
    try {
      await updateEvent(event.id, { status })
      setMessage("Estado del evento actualizado.")
      await load()
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo actualizar el estado."))
    }
  }

  const remove = async (event: Event) => {
    const confirmed = await prompt({
      title: "Eliminar evento",
      description: `Se eliminará lógicamente “${event.title}”. Dejará de mostrarse en Store, pero seguirá disponible para el historial administrativo y su archivo multimedia no se borra.`,
      confirmText: "Eliminar evento",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    setDeletingId(event.id)
    try {
      await deleteEvent(event.id)
      if (editing === event.id) reset()
      setMessage("Evento eliminado.")
      await load()
      requestAnimationFrame(() => document.getElementById("events-list-heading")?.focus())
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo eliminar el evento."))
    } finally {
      setDeletingId(null)
    }
  }

  const move = async (id: string, direction: -1 | 1) => {
    const ordered = moveEventWithinPriority(events, id, direction)
    if (ordered === events) return
    try {
      await reorderEvents(ordered.map((event) => event.id))
      setMessage("Orden de eventos actualizado.")
      await load()
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo reordenar los eventos."))
    }
  }

  const saveType = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const body = {
        code: typeForm.code,
        name: typeForm.name,
        description: typeForm.description || null,
      }
      if (typeForm.id) {
        await updateEventType(typeForm.id, body)
      } else {
        await createEventType(body)
      }
      setMessage("Tipo de evento guardado.")
      resetType()
      await load()
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo guardar el tipo de evento."))
    } finally {
      setSaving(false)
    }
  }

  const removeType = async (type: EventType) => {
    const confirmed = await prompt({
      title: "Eliminar tipo de evento",
      description: `Se eliminará “${type.name}” del catálogo de tipos. Si algún evento lo utiliza, la operación fallará y el tipo se conservará.`,
      confirmText: "Eliminar tipo",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    setDeletingTypeId(type.id)
    try {
      await deleteEventType(type.id)
      if (typeForm.id === type.id) resetType()
      setMessage("Tipo de evento eliminado.")
      await load()
      requestAnimationFrame(() => document.getElementById("event-types-heading")?.focus())
    } catch (error) {
      setMessage(errorMessage(error, "No se pudo eliminar el tipo de evento."))
    } finally {
      setDeletingTypeId(null)
    }
  }

  const removeMedia = () => {
    const wasVideo = isVideoMedia(previewUrl)
    setForm((current) => ({ ...current, media_file_id: null }))
    setPreviewUrl(null)
    setMessage(
      wasVideo
        ? "Multimedia retirada. Guarda el evento para persistir el cambio."
        : "Imagen retirada. Guarda el evento para persistir el cambio.",
    )
  }

  return {
    events,
    types,
    form,
    typeForm,
    editing,
    previewUrl,
    message,
    saving,
    deletingId,
    deletingTypeId,
    setForm,
    setTypeForm,
    reset,
    resetType,
    upload,
    edit,
    save,
    patch,
    remove,
    move,
    saveType,
    removeType,
    removeMedia,
  }
}
