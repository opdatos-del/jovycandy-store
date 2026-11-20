/**
 * Reglas puras de la bandeja multimedia de Novedades.
 *
 * La entidad es el mismo `jovy_event` de la agenda, así que este módulo no
 * reimplementa la publicación: replica las reglas del backend (`isEventVisible`
 * y `eventPublishIssues`) sólo para mostrar el estado real y evitar viajes
 * innecesarios al servidor.
 */

export type NoveltyStatus = "draft" | "published" | "archived" | "cancelled"
export type NoveltyMediaType = "image" | "gif" | "video"

export type NoveltyEvent = {
  id: string
  title: string
  title_en: string | null
  slug: string
  description: string | null
  status: NoveltyStatus
  enabled: boolean
  priority: number
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  event_type_id: string | null
  media_file_id: string | null
  media_url: string | null
  media_type: NoveltyMediaType | null
}

export type NoveltyDraft = Omit<NoveltyEvent, "id">

export type NoveltyFilters = {
  search: string
  status: NoveltyStatus | "all"
  media: NoveltyMediaType | "none" | "all"
  active: "all" | "yes" | "no"
}

export const emptyFilters = (): NoveltyFilters => ({
  search: "",
  status: "all",
  media: "all",
  active: "all",
})

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const VIDEO_MIME_TYPES = ["image/gif", "video/mp4", "video/webm"]
export const NOVELTY_MEDIA_ACCEPT = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",")

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type BadgeColor = "green" | "orange" | "red" | "grey" | "blue" | "purple"

export const STATUS_META: Record<NoveltyStatus, { label: string; color: BadgeColor }> = {
  draft: { label: "Borrador", color: "orange" },
  published: { label: "Publicado", color: "green" },
  archived: { label: "Archivado", color: "grey" },
  cancelled: { label: "Cancelado", color: "red" },
}

export const MEDIA_LABEL: Record<NoveltyMediaType, string> = {
  image: "image",
  gif: "gif",
  video: "video",
}

export const MEDIA_COLOR: Record<NoveltyMediaType, BadgeColor> = {
  image: "blue",
  gif: "orange",
  video: "green",
}

/** Las imágenes van por el carril de 5 MB; GIF y vídeo, por el de 100 MB. */
export function mediaLaneForFile(file: Pick<File, "type">): "image" | "video" | null {
  if (IMAGE_MIME_TYPES.includes(file.type)) return "image"
  if (VIDEO_MIME_TYPES.includes(file.type)) return "video"
  return null
}

export function isValidSlug(value: string) {
  const trimmed = value.trim()
  return trimmed.length >= 2 && SLUG_PATTERN.test(trimmed)
}

export function emptyDraft(): NoveltyDraft {
  return {
    title: "",
    title_en: null,
    slug: "",
    description: null,
    status: "draft",
    enabled: true,
    priority: 0,
    sort_order: 0,
    starts_at: null,
    ends_at: null,
    event_type_id: null,
    media_file_id: null,
    media_url: null,
    media_type: null,
  }
}

export function draftFromEvent(event: NoveltyEvent): NoveltyDraft {
  return {
    title: event.title,
    title_en: event.title_en,
    slug: event.slug,
    description: event.description,
    status: event.status,
    enabled: event.enabled,
    priority: event.priority,
    sort_order: event.sort_order,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    event_type_id: event.event_type_id,
    media_file_id: event.media_file_id,
    media_url: event.media_url,
    media_type: event.media_type,
  }
}

/** Campos que el PUT admite; `content` largo se sigue editando en Eventos. */
export function draftPayload(draft: NoveltyDraft) {
  return {
    title: draft.title.trim(),
    title_en: draft.title_en?.trim() || null,
    slug: draft.slug.trim(),
    description: draft.description?.trim() || null,
    status: draft.status,
    enabled: draft.enabled,
    priority: draft.priority,
    sort_order: draft.sort_order,
    starts_at: draft.starts_at,
    ends_at: draft.ends_at,
    event_type_id: draft.event_type_id,
    media_file_id: draft.media_file_id,
  }
}

/** Mismos requisitos que `eventPublishIssues` del backend. */
export function publishIssues(event: {
  title?: string | null
  title_en?: string | null
  event_type_id?: string | null
  starts_at?: string | null
  ends_at?: string | null
}) {
  const issues: string[] = []
  if (!event.title || event.title.trim().length < 2) issues.push("título en español")
  if (!event.title_en || event.title_en.trim().length < 2) issues.push("título en inglés")
  if (!event.event_type_id) issues.push("tipo de evento")
  if (!event.starts_at) {
    issues.push("fecha de inicio")
  } else if (event.ends_at && new Date(event.ends_at).getTime() <= new Date(event.starts_at).getTime()) {
    issues.push("rango de fechas coherente")
  }
  return issues
}

const startOfWindow = (value: string | null) => {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

/**
 * Visibilidad en el carrusel de Store. Es más estricta que la agenda porque el
 * storefront descarta novedades sin multimedia: por eso la ausencia de medio se
 * informa como motivo explícito y nunca como "publicada".
 */
export function noveltyStoreState(event: NoveltyEvent, now = new Date()): { visible: boolean; reason: string } {
  if (event.status === "draft") return { visible: false, reason: "Borrador: no se publica" }
  if (event.status === "archived") return { visible: false, reason: "Archivada: fuera de Store" }
  if (event.status === "cancelled") return { visible: false, reason: "Cancelada: fuera de Store" }
  if (!event.enabled) return { visible: false, reason: "Inactiva: oculta en Store" }

  const startsAt = startOfWindow(event.starts_at)
  if (startsAt !== null && startsAt > now.getTime()) {
    return { visible: false, reason: `Programada: inicia ${formatDateTime(event.starts_at)}` }
  }

  const endsAt = startOfWindow(event.ends_at)
  if (endsAt !== null && endsAt < now.getTime()) {
    return { visible: false, reason: `Ventana finalizada: ${formatDateTime(event.ends_at)}` }
  }

  if (!event.media_file_id && !event.media_url) {
    return { visible: false, reason: "Sin multimedia: el carrusel la omite" }
  }

  return { visible: true, reason: "Visible en el carrusel" }
}

export function formatDateTime(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "—"
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function formatWindow(event: Pick<NoveltyEvent, "starts_at" | "ends_at">) {
  if (!event.starts_at && !event.ends_at) return "Sin vigencia"
  if (event.starts_at && !event.ends_at) return `Desde ${formatDateTime(event.starts_at)}`
  if (!event.starts_at && event.ends_at) return `Hasta ${formatDateTime(event.ends_at)}`
  return `${formatDateTime(event.starts_at)} → ${formatDateTime(event.ends_at)}`
}

const searchable = (value: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")

/** Filtra sin reordenar: el orden de pantalla siempre es el de Store. */
export function filterNovelties(events: NoveltyEvent[], filters: NoveltyFilters) {
  const term = searchable(filters.search.trim())

  return events.filter((event) => {
    if (filters.status !== "all" && event.status !== filters.status) return false

    if (filters.media !== "all") {
      if (filters.media === "none") {
        if (event.media_type) return false
      } else if (event.media_type !== filters.media) {
        return false
      }
    }

    if (filters.active === "yes" && !event.enabled) return false
    if (filters.active === "no" && event.enabled) return false

    if (!term) return true
    return [event.title, event.title_en, event.slug].some((value) => searchable(value).includes(term))
  })
}

export function hasActiveFilters(filters: NoveltyFilters) {
  return (
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.media !== "all" ||
    filters.active !== "all"
  )
}

/** `datetime-local` trabaja en hora local; la API exige ISO con offset. */
export function toLocalInput(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function toIsoInput(value: string) {
  return value ? new Date(value).toISOString() : null
}
