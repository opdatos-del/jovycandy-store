import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Calendar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Textarea, usePrompt } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { canMoveEventWithinPriority, moveEventWithinPriority } from "./ordering"

type Status = "draft" | "published" | "archived" | "cancelled"
type Event = { id: string; title: string; title_en: string | null; slug: string; description: string | null; content: string | null; status: Status; enabled: boolean; priority: number; sort_order: number; starts_at: string | null; ends_at: string | null; event_type_id: string | null; media_file_id: string | null }
type EventType = { id: string; code: string; name: string; description: string | null }
type EventForm = Omit<Event, "id">
type TypeForm = { id: string | null; code: string; name: string; description: string }
const empty = (): EventForm => ({ title: "", title_en: null, slug: "", description: "", content: "", status: "draft", enabled: true, priority: 0, sort_order: 0, starts_at: null, ends_at: null, event_type_id: null, media_file_id: null })
// The PUT only receives editable fields; `id`, timestamps and soft-delete state
// are owned by the backend and must not be echoed back from a loaded row.
const editableEvent = (form: EventForm) => ({
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
const emptyType = (): TypeForm => ({ id: null, code: "", name: "", description: "" })
const toLocal = (date: string | null) => {
  if (!date) return ""
  const value = new Date(date)
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const toIso = (date: string) => date ? new Date(date).toISOString() : null
// Novedades puede asociar vídeo al mismo evento; el formulario de Eventos debe
// previsualizarlo sin intentar pintarlo como imagen.
const isVideoMedia = (url: string | null) => Boolean(url && /\.(?:mp4|webm|mov|m4v|ogg|ogv)(?:[?#]|$)/i.test(url))
async function api<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(path, { credentials: "include", ...init, headers: { ...init?.headers, ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }) } }); if (!response.ok) throw new Error((await response.json().catch(() => ({ message: "Operación no disponible" }))).message); return response.status === 204 ? undefined as T : response.json() as Promise<T> }

const EventsPage = () => {
  const prompt = usePrompt()
  const [events, setEvents] = useState<Event[]>([]); const [types, setTypes] = useState<EventType[]>([]); const [form, setForm] = useState<EventForm>(empty()); const [typeForm, setTypeForm] = useState<TypeForm>(emptyType()); const [editing, setEditing] = useState<string | null>(null); const [previewUrl, setPreviewUrl] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [deletingId, setDeletingId] = useState<string | null>(null); const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null)
  // Evita reabrir el editor en cada recarga si el enlace profundo ya se atendió.
  const deepLinkRef = useRef<string | null>(null)
  const load = async () => { try { const [eventResult, typeResult] = await Promise.all([api<{ events: Event[] }>("/admin/jovy/events"), api<{ event_types: EventType[] }>("/admin/jovy/events/types")]); setEvents(eventResult.events); setTypes(typeResult.event_types) } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron cargar los eventos.") } }
  useEffect(() => { void load() }, [])
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
  const reset = () => { setEditing(null); setForm(empty()); setPreviewUrl(null) }
  const resetType = () => setTypeForm(emptyType())
  const upload = async (file?: File) => { if (!file) return; setSaving(true); try { const data = new FormData(); data.append("files", file); const result = await api<{ file: { id: string; url: string } }>("/admin/jovy/marketing/media", { method: "POST", body: data }); setForm((current) => ({ ...current, media_file_id: result.file.id })); setPreviewUrl(result.file.url); setMessage("Imagen cargada y lista para guardar.") } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cargar el archivo.") } finally { setSaving(false) } }
  const edit = async (event: Event) => { setEditing(event.id); setTypeForm(emptyType()); setForm(event); setPreviewUrl(null); requestAnimationFrame(() => { document.getElementById("event-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("event-title-input")?.focus({ preventScroll: true }) }); if (!event.media_file_id) return; try { const media = await api<{ file: { url: string } }>(`/admin/jovy/marketing/media/${event.media_file_id}`); setPreviewUrl(media.file.url) } catch { setMessage("El archivo asociado ya no está disponible.") } }
  const save = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { await api(editing ? `/admin/jovy/events/${editing}` : "/admin/jovy/events", { method: editing ? "PUT" : "POST", body: JSON.stringify(editableEvent(form)) }); setMessage("Evento guardado."); reset(); await load() } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el evento.") } finally { setSaving(false) } }
  const patch = async (event: Event, status: Status) => { try { await api(`/admin/jovy/events/${event.id}`, { method: "PUT", body: JSON.stringify({ status }) }); setMessage("Estado del evento actualizado."); await load() } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo actualizar el estado.") } }
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
      await api(`/admin/jovy/events/${event.id}`, { method: "DELETE" })
      if (editing === event.id) reset()
      setMessage("Evento eliminado.")
      await load()
      requestAnimationFrame(() => document.getElementById("events-list-heading")?.focus())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el evento.")
    } finally {
      setDeletingId(null)
    }
  }
  const move = async (id: string, direction: -1 | 1) => { const ordered = moveEventWithinPriority(events, id, direction); if (ordered === events) return; try { await api("/admin/jovy/events/reorder", { method: "POST", body: JSON.stringify({ ids: ordered.map((event) => event.id) }) }); setMessage("Orden de eventos actualizado."); await load() } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo reordenar los eventos.") } }
  const saveType = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { const body = JSON.stringify({ code: typeForm.code, name: typeForm.name, description: typeForm.description || null }); await (typeForm.id ? api(`/admin/jovy/events/types/${typeForm.id}`, { method: "PUT", body }) : api("/admin/jovy/events/types", { method: "POST", body })); setMessage("Tipo de evento guardado."); resetType(); await load() } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el tipo de evento.") } finally { setSaving(false) } }
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
      await api(`/admin/jovy/events/types/${type.id}`, { method: "DELETE" })
      if (typeForm.id === type.id) resetType()
      setMessage("Tipo de evento eliminado.")
      await load()
      requestAnimationFrame(() => document.getElementById("event-types-heading")?.focus())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el tipo de evento.")
    } finally {
      setDeletingTypeId(null)
    }
  }

  return <div className="flex flex-col gap-y-4">
    <Container className="p-6"><div className="flex flex-wrap justify-between gap-3"><div><Heading level="h1">Eventos</Heading><p className="text-ui-fg-subtle text-sm">Agenda corporativa con ciclo editorial, vigencia y prioridad.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><a href="/app/jovy/novelties">Gestionar multimedia en Novedades</a></Button><Button variant="secondary" onClick={reset}>Nuevo evento</Button></div></div>{message && <p role="alert" className="mt-3 text-ui-fg-error">{message}</p>}</Container>
    <Container className="p-6"><Heading level="h2" id="event-types-heading" tabIndex={-1}>Tipos de evento</Heading>{types.length === 0 ? <p className="mt-4 text-ui-fg-subtle">Aún no hay tipos de evento.</p> : <ul className="mt-4 divide-y">{types.map((type) => <li key={type.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{type.name}</p><p className="text-ui-fg-subtle text-sm">{type.code}{type.description ? ` · ${type.description}` : ""}</p></div><div className="flex gap-2"><Button size="small" variant="secondary" onClick={() => setTypeForm({ id: type.id, code: type.code, name: type.name, description: type.description ?? "" })}>Editar tipo</Button><Button size="small" variant="danger" isLoading={deletingTypeId === type.id} onClick={() => void removeType(type)}>Eliminar tipo</Button></div></li>)}</ul>}<form className="mt-4 flex max-w-2xl flex-col gap-3" onSubmit={(event) => void saveType(event)}><Input required aria-label="Código tipo evento" value={typeForm.code} onChange={(event) => setTypeForm({ ...typeForm, code: event.target.value })} placeholder="feria" /><Input required aria-label="Nombre tipo evento" value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} placeholder="Feria" /><Textarea aria-label="Descripción tipo evento" value={typeForm.description} onChange={(event) => setTypeForm({ ...typeForm, description: event.target.value })} placeholder="Descripción" /><div className="flex gap-2"><Button type="submit" isLoading={saving}>{typeForm.id ? "Guardar tipo" : "Crear tipo"}</Button>{typeForm.id && <Button type="button" variant="secondary" onClick={resetType}>Cancelar tipo</Button>}</div></form></Container>
    <Container className="p-6"><Heading level="h2" id="events-list-heading" tabIndex={-1}>Eventos</Heading>{events.length === 0 ? <p className="mt-4 text-ui-fg-subtle">Aún no hay eventos.</p> : <ul className="mt-4 divide-y">{events.map((event) => <li key={event.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{event.title}</p><p className="text-ui-fg-subtle text-sm">/{event.slug} · prioridad {event.priority} · orden {event.sort_order}{event.title_en ? "" : " · falta título EN"}</p></div><div className="flex flex-wrap gap-2"><Badge color={event.status === "published" ? "green" : event.status === "cancelled" ? "red" : "orange"}>{event.status}</Badge><Button asChild size="small" variant="secondary"><a href={`/app/jovy/novelties?event=${encodeURIComponent(event.id)}`}>Multimedia en Novedades</a></Button><Button size="small" variant="secondary" onClick={() => void move(event.id, -1)} disabled={!canMoveEventWithinPriority(events, event.id, -1)}>Subir</Button><Button size="small" variant="secondary" onClick={() => void move(event.id, 1)} disabled={!canMoveEventWithinPriority(events, event.id, 1)}>Bajar</Button>{event.status !== "published" && <Button size="small" variant="secondary" onClick={() => void patch(event, "published")}>Publicar</Button>}{event.status !== "archived" && <Button size="small" variant="secondary" onClick={() => void patch(event, "archived")}>Archivar</Button>}<Button size="small" variant="secondary" onClick={() => void edit(event)}>Editar</Button><Button size="small" variant="danger" isLoading={deletingId === event.id} onClick={() => void remove(event)}>Eliminar</Button></div></li>)}</ul>}</Container>
    <Container className="p-6" id="event-editor"><Heading level="h2">{editing ? "Editar evento" : "Nuevo evento"}</Heading><form className="mt-4 flex max-w-3xl flex-col gap-4" onSubmit={(event) => void save(event)}><Input required id="event-title-input" aria-label="Título evento" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><Input aria-label="Título EN evento" value={form.title_en ?? ""} onChange={(event) => setForm({ ...form, title_en: event.target.value || null })} placeholder="Event title (EN) — obligatorio para publicar" /><Input required aria-label="Slug evento" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="evento-corporativo" /><Textarea aria-label="Descripción evento" value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value || null })} /><Textarea aria-label="Contenido evento" value={form.content ?? ""} onChange={(event) => setForm({ ...form, content: event.target.value || null })} /><select aria-label="Tipo evento" value={form.event_type_id ?? ""} onChange={(event) => setForm({ ...form, event_type_id: event.target.value || null })}><option value="">Sin tipo</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><div className="grid grid-cols-2 gap-3"><Input type="datetime-local" aria-label="Inicio evento" value={toLocal(form.starts_at)} onChange={(event) => setForm({ ...form, starts_at: toIso(event.target.value) })} /><Input type="datetime-local" aria-label="Fin evento" value={toLocal(form.ends_at)} onChange={(event) => setForm({ ...form, ends_at: toIso(event.target.value) })} /></div><div className="flex gap-3"><select aria-label="Estado evento" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option><option value="cancelled">Cancelado</option></select><label><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Activo</label><Input type="number" min="0" aria-label="Prioridad evento" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /><Input type="number" min="0" aria-label="Orden evento" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} /></div><div><label htmlFor="event-media">Imagen del evento</label><Input id="event-media" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event.target.files?.[0])} disabled={saving} /><p className="text-ui-fg-subtle mt-1 text-sm">Los GIF y vídeos se reemplazan desde Novedades; aquí sólo se sube la imagen del evento.</p>{previewUrl ? <div className="mt-3 flex flex-col gap-2">{isVideoMedia(previewUrl) ? <video aria-label="Vista previa evento" src={previewUrl} controls muted playsInline preload="metadata" className="max-h-48 rounded-md" /> : <img src={previewUrl} alt="Vista previa evento" className="max-h-48 rounded-md" />}<Button type="button" size="small" variant="secondary" onClick={() => { setForm((current) => ({ ...current, media_file_id: null })); setPreviewUrl(null); setMessage(isVideoMedia(previewUrl) ? "Multimedia retirada. Guarda el evento para persistir el cambio." : "Imagen retirada. Guarda el evento para persistir el cambio.") }}>{isVideoMedia(previewUrl) ? "Quitar multimedia del evento" : "Quitar imagen del evento"}</Button></div> : form.media_file_id ? <p className="mt-2 text-ui-fg-subtle">No fue posible recuperar la vista previa del archivo asociado.</p> : null}</div><Button type="submit" isLoading={saving}>{editing ? "Guardar cambios" : "Crear evento"}</Button></form></Container>
  </div>
}

export const config = defineRouteConfig({ label: "Eventos Jovy", icon: Calendar, rank: 3 })
export default EventsPage
