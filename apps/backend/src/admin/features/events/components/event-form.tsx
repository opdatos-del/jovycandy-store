import { Button, Container, Heading, Input, Textarea } from "@medusajs/ui"
import { isVideoMedia, toIso, toLocal, type EventForm, type EventType, type Status } from "../types"

type EventFormPanelProps = {
  form: EventForm
  types: EventType[]
  editing: string | null
  previewUrl: string | null
  saving: boolean
  onChange: (form: EventForm) => void
  onUpload: (file?: File) => void
  onRemoveMedia: () => void
  onSubmit: (event: React.FormEvent) => void
}

/**
 * Editor de un evento: contenido bilingüe, ciclo editorial, vigencia, prioridad
 * y multimedia. La vista previa distingue imagen de vídeo porque Novedades
 * puede asociar vídeo al mismo evento.
 */
export const EventFormPanel = ({
  form,
  types,
  editing,
  previewUrl,
  saving,
  onChange,
  onUpload,
  onRemoveMedia,
  onSubmit,
}: EventFormPanelProps) => {
  const previewIsVideo = isVideoMedia(previewUrl)

  return (
    <Container className="p-6" id="event-editor">
      <Heading level="h2">{editing ? "Editar evento" : "Nuevo evento"}</Heading>
      <form className="mt-4 flex max-w-3xl flex-col gap-4" onSubmit={onSubmit}>
        <Input required id="event-title-input" aria-label="Título evento" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} />
        <Input aria-label="Título EN evento" value={form.title_en ?? ""} onChange={(event) => onChange({ ...form, title_en: event.target.value || null })} placeholder="Event title (EN) — obligatorio para publicar" />
        <Input required aria-label="Slug evento" value={form.slug} onChange={(event) => onChange({ ...form, slug: event.target.value })} placeholder="evento-corporativo" />
        <Textarea aria-label="Descripción evento" value={form.description ?? ""} onChange={(event) => onChange({ ...form, description: event.target.value || null })} />
        <Textarea aria-label="Contenido evento" value={form.content ?? ""} onChange={(event) => onChange({ ...form, content: event.target.value || null })} />
        <select aria-label="Tipo evento" value={form.event_type_id ?? ""} onChange={(event) => onChange({ ...form, event_type_id: event.target.value || null })}>
          <option value="">Sin tipo</option>
          {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <Input type="datetime-local" aria-label="Inicio evento" value={toLocal(form.starts_at)} onChange={(event) => onChange({ ...form, starts_at: toIso(event.target.value) })} />
          <Input type="datetime-local" aria-label="Fin evento" value={toLocal(form.ends_at)} onChange={(event) => onChange({ ...form, ends_at: toIso(event.target.value) })} />
        </div>
        <div className="flex gap-3">
          <select aria-label="Estado evento" value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as Status })}>
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
            <option value="cancelled">Cancelado</option>
          </select>
          <label>
            <input type="checkbox" checked={form.enabled} onChange={(event) => onChange({ ...form, enabled: event.target.checked })} /> Activo</label>
          <Input type="number" min="0" aria-label="Prioridad evento" value={form.priority} onChange={(event) => onChange({ ...form, priority: Number(event.target.value) })} />
          <Input type="number" min="0" aria-label="Orden evento" value={form.sort_order} onChange={(event) => onChange({ ...form, sort_order: Number(event.target.value) })} />
        </div>
        <div>
          <label htmlFor="event-media">Imagen del evento</label>
          <Input id="event-media" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload(event.target.files?.[0])} disabled={saving} />
          <p className="text-ui-fg-subtle mt-1 text-sm">Los GIF y vídeos se reemplazan desde Novedades; aquí sólo se sube la imagen del evento.</p>
          {previewUrl ? (
            <div className="mt-3 flex flex-col gap-2">
              {previewIsVideo ? (
                <video aria-label="Vista previa evento" src={previewUrl} controls muted playsInline preload="metadata" className="max-h-48 rounded-md" />
              ) : (
                <img src={previewUrl} alt="Vista previa evento" className="max-h-48 rounded-md" />
              )}
              <Button type="button" size="small" variant="secondary" onClick={onRemoveMedia}>{previewIsVideo ? "Quitar multimedia del evento" : "Quitar imagen del evento"}</Button>
            </div>
          ) : form.media_file_id ? (
            <p className="mt-2 text-ui-fg-subtle">No fue posible recuperar la vista previa del archivo asociado.</p>
          ) : null}
        </div>
        <Button type="submit" isLoading={saving}>{editing ? "Guardar cambios" : "Crear evento"}</Button>
      </form>
    </Container>
  )
}
