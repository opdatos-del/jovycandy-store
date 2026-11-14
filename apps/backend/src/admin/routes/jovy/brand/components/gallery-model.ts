/**
 * Reglas compartidas por la pestaña Galería. El cálculo de cupo replica el
 * contrato del backend (`apps/backend/src/lib/jovy/brand.ts`): cuatro elementos
 * publicados y activos como máximo en un mismo instante, no cuatro filas.
 */
export const MAX_VISIBLE_GALLERY_ITEMS = 4

export type GalleryStatus = "draft" | "published" | "archived"

export type GalleryItem = {
  id: string
  title: string | null
  description: string | null
  media_file_id: string
  media_url: string | null
  status: GalleryStatus
  enabled: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
}

/** Campos editables del formulario; `id` y `media_url` los resuelve el backend. */
export type GalleryDraft = Omit<GalleryItem, "id" | "media_url">

export const emptyGalleryDraft = (): GalleryDraft => ({
  title: "",
  description: "",
  media_file_id: "",
  status: "draft",
  enabled: true,
  sort_order: 0,
  starts_at: null,
  ends_at: null,
})

/** Mismo rango que usa el backend cuando la ventana no tiene extremo. */
const MIN_TIME = -8_640_000_000_000_000
const MAX_TIME = 8_640_000_000_000_000

export const galleryTitle = (item: Pick<GalleryItem, "title">) => item.title?.trim() || "Sin título"

export function windowStart(item: Pick<GalleryItem, "starts_at">) {
  return item.starts_at ? new Date(item.starts_at).getTime() : MIN_TIME
}

export function windowEnd(item: Pick<GalleryItem, "ends_at">) {
  return item.ends_at ? new Date(item.ends_at).getTime() : MAX_TIME
}

/** Las ventanas son intervalos cerrados: ambos extremos cuentan como visibles. */
export function isWindowActiveAt(item: Pick<GalleryItem, "starts_at" | "ends_at">, at: number) {
  return windowStart(item) <= at && windowEnd(item) >= at
}

export function isVisibleNow(
  item: Pick<GalleryItem, "status" | "enabled" | "starts_at" | "ends_at">,
  at = Date.now(),
) {
  return item.status === "published" && item.enabled && isWindowActiveAt(item, at)
}

/**
 * Pico de elementos simultáneos a lo largo de toda la agenda. Basta evaluar los
 * extremos de cada ventana, igual que el barrido del backend.
 */
export function maxSimultaneous(items: GalleryItem[]) {
  const visible = items.filter((item) => item.status === "published" && item.enabled)
  const boundaries = new Set<number>()
  for (const item of visible) {
    boundaries.add(windowStart(item))
    boundaries.add(windowEnd(item))
  }
  let peak = 0
  for (const boundary of boundaries) {
    peak = Math.max(peak, visible.filter((item) => isWindowActiveAt(item, boundary)).length)
  }
  return peak
}

export type WindowGroup = { ids: string[]; start: number; end: number }

/**
 * Agrupa las ventanas publicadas y activas que se solapan, incluyendo el caso
 * en que una termina justo cuando otra empieza. Devuelve solo grupos de dos o más.
 */
export function overlappingWindowGroups(items: GalleryItem[]): WindowGroup[] {
  const intervals = items
    .filter((item) => item.status === "published" && item.enabled)
    .map((item) => ({ ids: [item.id], start: windowStart(item), end: windowEnd(item) }))
    .sort((left, right) => left.start - right.start)

  const groups: WindowGroup[] = []
  for (const interval of intervals) {
    const current = groups[groups.length - 1]
    if (current && interval.start <= current.end) {
      current.ids.push(...interval.ids)
      current.end = Math.max(current.end, interval.end)
      continue
    }
    groups.push({ ...interval, ids: [...interval.ids] })
  }
  return groups.filter((group) => group.ids.length > 1)
}

export type PublicationState = "visible" | "scheduled" | "expired" | "inactive" | "draft" | "archived"

export function publicationState(item: GalleryItem, at = Date.now()): PublicationState {
  if (item.status === "draft") return "draft"
  if (item.status === "archived") return "archived"
  if (!item.enabled) return "inactive"
  if (windowEnd(item) < at) return "expired"
  if (windowStart(item) > at) return "scheduled"
  return "visible"
}

export const statusLabel: Record<GalleryStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
}

export const statusColor = (status: GalleryStatus): "green" | "orange" | "grey" =>
  status === "published" ? "green" : status === "draft" ? "orange" : "grey"

export const publicationLabel: Record<PublicationState, string> = {
  visible: "Visible ahora",
  scheduled: "Programado",
  expired: "Ventana vencida",
  inactive: "Inactivo",
  draft: "No publicado",
  archived: "Archivado",
}

export const publicationColor = (state: PublicationState): "green" | "blue" | "grey" | "orange" =>
  state === "visible" ? "green" : state === "scheduled" ? "blue" : state === "draft" ? "orange" : "grey"

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" })

export const formatInstant = (value: number) => dateTimeFormatter.format(new Date(value))

/** Texto legible de la ventana; `sin fin` evita mostrar el extremo técnico. */
export function formatWindow(item: Pick<GalleryItem, "starts_at" | "ends_at">) {
  if (!item.starts_at && !item.ends_at) return "Sin ventana: visible mientras esté publicado y activo"
  const start = item.starts_at ? formatInstant(windowStart(item)) : "Sin inicio"
  const end = item.ends_at ? formatInstant(windowEnd(item)) : "Sin fin"
  return `${start} → ${end}`
}

export function formatGroupRange(group: WindowGroup) {
  const start = group.start === MIN_TIME ? "Sin inicio" : formatInstant(group.start)
  const end = group.end === MAX_TIME ? "Sin fin" : formatInstant(group.end)
  return `${start} → ${end}`
}

/** `datetime-local` trabaja en hora local; el backend persiste ISO en UTC. */
export function toDateTimeLocal(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function fromDateTimeLocal(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Sugiere el siguiente orden al crear sin recalcular toda la lista. */
export function nextSortOrder(items: GalleryItem[]) {
  return items.reduce((next, item) => Math.max(next, item.sort_order + 1), 0)
}
