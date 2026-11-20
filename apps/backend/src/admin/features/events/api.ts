import { adminRequest } from "@admin/shared/lib/admin-api"
import type { Event, EventForm, EventType } from "./types"

type EventTypePayload = { code: string; name: string; description: string | null }

/**
 * Operaciones HTTP de la agenda sobre los endpoints existentes
 * `/admin/jovy/events` y el carril de imágenes de marketing. No hay endpoints
 * nuevos ni contratos alternativos.
 */

const EVENTS_PATH = "/admin/jovy/events"
const TYPES_PATH = `${EVENTS_PATH}/types`
const MEDIA_PATH = "/admin/jovy/marketing/media"

export async function fetchEvents(): Promise<Event[]> {
  const result = await adminRequest<{ events: Event[] }>(EVENTS_PATH)
  return result.events
}

export async function fetchEventTypes(): Promise<EventType[]> {
  const result = await adminRequest<{ event_types: EventType[] }>(TYPES_PATH)
  return result.event_types
}

export function createEvent(body: EventForm) {
  return adminRequest(EVENTS_PATH, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function updateEvent(id: string, body: Partial<EventForm>) {
  return adminRequest(`${EVENTS_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function deleteEvent(id: string) {
  return adminRequest(`${EVENTS_PATH}/${id}`, { method: "DELETE" })
}

export function reorderEvents(ids: string[]) {
  return adminRequest(`${EVENTS_PATH}/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

export function createEventType(type: EventTypePayload) {
  return adminRequest(TYPES_PATH, {
    method: "POST",
    body: JSON.stringify({
      code: type.code,
      name: type.name,
      description: type.description,
    }),
  })
}

export function updateEventType(id: string, type: EventTypePayload) {
  return adminRequest(`${TYPES_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      code: type.code,
      name: type.name,
      description: type.description,
    }),
  })
}

export function deleteEventType(id: string) {
  return adminRequest(`${TYPES_PATH}/${id}`, { method: "DELETE" })
}

/** Carril de imágenes del CMS: PNG/JPEG/WebP. El servidor valida firma y MIME. */
export async function uploadEventImage(file: File): Promise<{ id: string; url: string }> {
  const body = new FormData()
  body.append("files", file)
  const result = await adminRequest<{ file: { id: string; url: string } }>(MEDIA_PATH, {
    method: "POST",
    body,
  })
  return result.file
}

export async function fetchMediaUrl(id: string): Promise<string> {
  const result = await adminRequest<{ file: { url: string } }>(`${MEDIA_PATH}/${id}`)
  return result.file.url
}
