/**
 * Tipos y helpers puros de la agenda de Eventos Jovy. `Event` es el mismo
 * `jovy_event` que consumen Novedades y Store; aquí sólo se declara el
 * contrato editable desde el Admin.
 */

export type Status = "draft" | "published" | "archived" | "cancelled"

export type Event = {
  id: string
  title: string
  title_en: string | null
  slug: string
  description: string | null
  content: string | null
  status: Status
  enabled: boolean
  priority: number
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  event_type_id: string | null
  media_file_id: string | null
}

export type EventType = { id: string; code: string; name: string; description: string | null }

export type EventForm = Omit<Event, "id">

export type TypeForm = { id: string | null; code: string; name: string; description: string }

export const emptyEvent = (): EventForm => ({
  title: "",
  title_en: null,
  slug: "",
  description: "",
  content: "",
  status: "draft",
  enabled: true,
  priority: 0,
  sort_order: 0,
  starts_at: null,
  ends_at: null,
  event_type_id: null,
  media_file_id: null,
})

// The PUT only receives editable fields; `id`, timestamps and soft-delete state
// are owned by the backend and must not be echoed back from a loaded row.
export const editableEvent = (form: EventForm) => ({
  title: form.title,
  title_en: form.title_en,
  slug: form.slug,
  description: form.description,
  content: form.content,
  status: form.status,
  enabled: form.enabled,
  priority: form.priority,
  sort_order: form.sort_order,
  starts_at: form.starts_at,
  ends_at: form.ends_at,
  event_type_id: form.event_type_id,
  media_file_id: form.media_file_id,
})

export const emptyType = (): TypeForm => ({ id: null, code: "", name: "", description: "" })

/** `datetime-local` trabaja en hora local; el contrato HTTP usa ISO en UTC. */
export const toLocal = (date: string | null) => {
  if (!date) return ""
  const value = new Date(date)
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export const toIso = (date: string) => date ? new Date(date).toISOString() : null

// Novedades puede asociar vídeo al mismo evento; el formulario de Eventos debe
// previsualizarlo sin intentar pintarlo como imagen.
export const isVideoMedia = (url: string | null) =>
  Boolean(url && /\.(?:mp4|webm|mov|m4v|ogg|ogv)(?:[?#]|$)/i.test(url))
