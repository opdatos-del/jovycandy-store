import { adminRequest } from "@admin/shared/lib/admin-api"
import { uploadImageTo } from "@admin/shared/lib/media"
import { draftPayload, type NoveltyDraft, type NoveltyEvent, type NoveltyMediaType } from "./model"
import type { EventType, UploadedMedia } from "./types"

/**
 * Operaciones HTTP de Novedades sobre los endpoints existentes de Eventos
 * Jovy. No hay endpoints nuevos ni contratos alternativos: la entidad es el
 * mismo `jovy_event` de la agenda y la multimedia usa los carriles ya
 * publicados (5 MB para imágenes, 100 MB para GIF y vídeo).
 */

const EVENTS_PATH = "/admin/jovy/events"

/**
 * Carga inicial de la bandeja. Devuelve ambos resultados por separado porque
 * la pantalla distingue dos fallos: sin eventos no hay lista, pero sin tipos de
 * evento la lista sigue siendo revisable y sólo se advierte que no se puede
 * publicar.
 */
export async function list() {
  const [events, types] = await Promise.allSettled([
    adminRequest<{ events: NoveltyEvent[] }>(EVENTS_PATH),
    adminRequest<{ event_types: EventType[] }>(`${EVENTS_PATH}/types`),
  ] as const)

  return { events, types }
}

export function create(draft: NoveltyDraft) {
  return adminRequest(EVENTS_PATH, {
    method: "POST",
    body: JSON.stringify(draftPayload(draft)),
  })
}

export function update(id: string, body: Record<string, unknown>) {
  return adminRequest(`${EVENTS_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function remove(id: string) {
  return adminRequest(`${EVENTS_PATH}/${id}`, { method: "DELETE" })
}

export function reorder(ids: string[]) {
  return adminRequest(`${EVENTS_PATH}/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

export function saveOrder(id: string, order: { priority: number; sort_order: number }) {
  return update(id, order)
}

/** Carril de imágenes del CMS: PNG/JPEG/WebP hasta 5 MB. */
export async function uploadImage(file: File): Promise<UploadedMedia> {
  const uploaded = await uploadImageTo("/admin/jovy/marketing/media", file)
  return { ...uploaded, media_type: "image" }
}

/** Carril de GIF y vídeo de Eventos: hasta 100 MB. */
export async function uploadVideo(file: File): Promise<UploadedMedia> {
  const body = new FormData()
  body.append("files", file)

  const uploaded = await adminRequest<{
    file: { id: string; url?: string | null }
    media_type: NoveltyMediaType
  }>(`${EVENTS_PATH}/media/video`, { method: "POST", body })

  return { id: uploaded.file.id, url: uploaded.file.url ?? null, media_type: uploaded.media_type }
}
