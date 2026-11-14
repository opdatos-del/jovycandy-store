import { Badge, Button, Container, Heading, Input, Switch, Text, Textarea } from "@medusajs/ui"
import {
  NOVELTY_MEDIA_ACCEPT,
  STATUS_META,
  publishIssues,
  toIsoInput,
  toLocalInput,
  type NoveltyDraft,
  type NoveltyEvent,
  type NoveltyStatus,
} from "../model"

type EventType = { id: string; name: string }

type Props = {
  draft: NoveltyDraft
  editing: NoveltyEvent | null
  eventTypes: EventType[]
  uploading: boolean
  saving: boolean
  error: string | null
  onChange: (patch: Partial<NoveltyDraft>) => void
  onUpload: (file: File) => void
  onRemoveMedia: () => void
  onSave: () => void
  onCancel: () => void
}

const fieldClass =
  "border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive w-full rounded-md border px-2 py-1.5 text-sm outline-hidden focus-visible:ring-2"

const labelClass = "text-ui-fg-subtle text-xs font-medium"

const STATUS_OPTIONS: Array<{ value: NoveltyStatus; label: string }> = [
  { value: "draft", label: "Borrador (no se publica)" },
  { value: "published", label: "Publicado (visible si cumple requisitos)" },
  { value: "archived", label: "Archivado (fuera de Store)" },
  { value: "cancelled", label: "Cancelado (fuera de Store)" },
]

const numberValue = (value: string, max?: number) => {
  const parsed = Number(value)
  const base = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0
  return max === undefined ? base : Math.min(max, base)
}

export const NoveltyForm = ({
  draft,
  editing,
  eventTypes,
  uploading,
  saving,
  error,
  onChange,
  onUpload,
  onRemoveMedia,
  onSave,
  onCancel,
}: Props) => {
  const issues = draft.status === "published" ? publishIssues(draft) : []

  return (
    <Container className="p-6" id="novelty-editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level="h2">{editing ? "Editar novedad" : "Nueva novedad"}</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Misma entidad que Eventos Jovy. Aquí se administran la multimedia, la vigencia, el orden y los metadatos del
            carrusel; el contenido largo se edita en Eventos.
          </Text>
        </div>
        <Badge color={STATUS_META[draft.status].color}>{STATUS_META[draft.status].label}</Badge>
      </div>

      {error && (
        <Text size="small" role="alert" className="text-ui-fg-error mt-3">
          {error}
        </Text>
      )}

      <form
        data-testid="novelty-form"
        className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12"
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <section className="border-ui-border-base lg:col-span-8 flex min-w-0 flex-col gap-y-4 rounded-lg border p-5">
          <Heading level="h3">Metadatos del carrusel</Heading>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-y-1">
              <label htmlFor="novelty-title" className={labelClass}>
                Título en español
              </label>
              <Input
                id="novelty-title"
                required
                minLength={2}
                maxLength={180}
                value={draft.title}
                onChange={(event) => onChange({ title: event.target.value })}
                placeholder="Lanzamiento de temporada"
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <label htmlFor="novelty-title-en" className={labelClass}>
                Título en inglés
              </label>
              <Input
                id="novelty-title-en"
                maxLength={180}
                value={draft.title_en ?? ""}
                onChange={(event) => onChange({ title_en: event.target.value || null })}
                placeholder="Season launch — obligatorio para publicar"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-y-1">
              <label htmlFor="novelty-slug" className={labelClass}>
                Slug público
              </label>
              <Input
                id="novelty-slug"
                required
                minLength={2}
                maxLength={180}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={draft.slug}
                onChange={(event) => onChange({ slug: event.target.value })}
                placeholder="lanzamiento-temporada"
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                Minúsculas, números y guiones. Se usa en la URL de Store.
              </Text>
            </div>
            <div className="flex flex-col gap-y-1">
              <label htmlFor="novelty-event-type" className={labelClass}>
                Tipo de evento
              </label>
              <select
                id="novelty-event-type"
                className={fieldClass}
                value={draft.event_type_id ?? ""}
                onChange={(event) => onChange({ event_type_id: event.target.value || null })}
              >
                <option value="">Sin tipo (no se puede publicar)</option>
                {eventTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-y-1">
            <label htmlFor="novelty-description" className={labelClass}>
              Descripción
            </label>
            <Textarea
              id="novelty-description"
              maxLength={2000}
              value={draft.description ?? ""}
              onChange={(event) => onChange({ description: event.target.value || null })}
              placeholder="Texto breve que acompaña a la novedad."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-y-1">
              <label htmlFor="novelty-starts-at" className={labelClass}>
                Inicio de vigencia
              </label>
              <Input
                id="novelty-starts-at"
                type="datetime-local"
                value={toLocalInput(draft.starts_at)}
                onChange={(event) => onChange({ starts_at: toIsoInput(event.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-y-1">
              <label htmlFor="novelty-ends-at" className={labelClass}>
                Fin de vigencia
              </label>
              <Input
                id="novelty-ends-at"
                type="datetime-local"
                value={toLocalInput(draft.ends_at)}
                onChange={(event) => onChange({ ends_at: toIsoInput(event.target.value) })}
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                Sin fechas, la novedad publicada permanece visible mientras esté activa.
              </Text>
            </div>
          </div>
        </section>

        <aside className="lg:col-span-4 flex min-w-0 flex-col gap-y-4">
          <section className="border-ui-border-base flex flex-col gap-y-4 rounded-lg border p-5">
            <Heading level="h3">Publicación y orden</Heading>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="novelty-status" className={labelClass}>
                Estado editorial
              </label>
              <select
                id="novelty-status"
                className={fieldClass}
                value={draft.status}
                onChange={(event) => onChange({ status: event.target.value as NoveltyStatus })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {issues.length > 0 && (
              <div className="border-ui-border-base bg-ui-bg-subtle rounded-md border p-3" role="status">
                <Text size="small" weight="plus" className="text-ui-fg-error">
                  Para publicar falta:
                </Text>
                <Text size="small" className="text-ui-fg-subtle">
                  {issues.join(", ")}.
                </Text>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <label htmlFor="novelty-enabled" className="text-sm font-medium">
                  Activa en Store
                </label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Una novedad inactiva no aparece aunque esté publicada.
                </Text>
              </div>
              <Switch
                id="novelty-enabled"
                aria-label="Activa en Store"
                checked={draft.enabled}
                disabled={saving}
                onCheckedChange={(enabled) => onChange({ enabled })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-y-1">
                <label htmlFor="novelty-priority" className={labelClass}>
                  Prioridad
                </label>
                <Input
                  id="novelty-priority"
                  type="number"
                  min={0}
                  max={1000}
                  value={draft.priority}
                  onChange={(event) => onChange({ priority: numberValue(event.target.value, 1000) })}
                />
              </div>
              <div className="flex flex-col gap-y-1">
                <label htmlFor="novelty-sort-order" className={labelClass}>
                  Orden
                </label>
                <Input
                  id="novelty-sort-order"
                  type="number"
                  min={0}
                  value={draft.sort_order}
                  onChange={(event) => onChange({ sort_order: numberValue(event.target.value) })}
                />
              </div>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              La Store ordena por prioridad descendente y después por orden ascendente; la prioridad siempre manda.
            </Text>
          </section>

          <section className="border-ui-border-base flex flex-col gap-y-3 rounded-lg border p-5">
            <Heading level="h3">Multimedia</Heading>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Imagen PNG/JPEG/WebP hasta 5 MB o GIF/MP4/WebM hasta 100 MB. La firma real del archivo se valida en el
              servidor.
            </Text>

            <div className="bg-ui-bg-subtle flex min-h-40 items-center justify-center overflow-hidden rounded-md p-2">
              {draft.media_url && draft.media_type === "video" ? (
                <video
                  data-testid="novelty-form-preview"
                  aria-label="Vista previa de la novedad"
                  src={draft.media_url}
                  muted
                  loop
                  playsInline
                  controls
                  preload="metadata"
                  className="max-h-56 w-full rounded bg-black object-contain"
                />
              ) : draft.media_url ? (
                <img
                  data-testid="novelty-form-preview"
                  src={draft.media_url}
                  alt="Vista previa de la novedad"
                  className="max-h-56 w-full rounded object-contain"
                />
              ) : (
                <Text size="small" className="text-ui-fg-subtle">
                  Sin multimedia asociada
                </Text>
              )}
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="novelty-media-input" className={labelClass}>
                {draft.media_file_id ? "Reemplazar multimedia" : "Añadir multimedia"}
              </label>
              <Input
                id="novelty-media-input"
                type="file"
                accept={NOVELTY_MEDIA_ACCEPT}
                aria-label="Multimedia de la novedad"
                disabled={uploading || saving}
                onClick={(event) => {
                  event.currentTarget.value = ""
                }}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onUpload(file)
                }}
              />
              {uploading && (
                <Text size="xsmall" className="text-ui-fg-subtle" role="status">
                  Subiendo multimedia…
                </Text>
              )}
            </div>

            <Button
              type="button"
              size="small"
              variant="danger"
              disabled={!draft.media_file_id || saving}
              onClick={onRemoveMedia}
            >
              Quitar multimedia
            </Button>
          </section>
        </aside>

        <div className="lg:col-span-12 flex flex-wrap items-center gap-2">
          <Button type="submit" isLoading={saving}>
            {editing ? "Guardar novedad" : "Crear novedad"}
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
            Cancelar
          </Button>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {editing
              ? "Los cambios de estado publicados o archivados piden confirmación."
              : "El borrador se crea sin publicar; publicar exige título EN, tipo y fecha de inicio."}
          </Text>
        </div>
      </form>
    </Container>
  )
}
