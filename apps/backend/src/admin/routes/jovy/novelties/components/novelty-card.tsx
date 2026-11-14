import { Badge, Button, Heading, Input, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import {
  MEDIA_COLOR,
  MEDIA_LABEL,
  NOVELTY_MEDIA_ACCEPT,
  STATUS_META,
  formatWindow,
  type NoveltyEvent,
} from "../model"

type Props = {
  event: NoveltyEvent
  /** Posición real en la Store (prioridad y orden), no la posición filtrada. */
  position: number
  store: { visible: boolean; reason: string }
  canMoveUp: boolean
  canMoveDown: boolean
  filtersActive: boolean
  busy: boolean
  highlighted: boolean
  onEdit: () => void
  onMove: (direction: -1 | 1) => void
  onSaveOrder: (order: { priority: number; sort_order: number }) => void
  onToggleEnabled: () => void
  onPublish: () => void
  onArchive: () => void
  onDelete: () => void
  onReplaceMedia: (file: File) => void
  onRemoveMedia: () => void
}

const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback
}

export const NoveltyCard = ({
  event,
  position,
  store,
  canMoveUp,
  canMoveDown,
  filtersActive,
  busy,
  highlighted,
  onEdit,
  onMove,
  onSaveOrder,
  onToggleEnabled,
  onPublish,
  onArchive,
  onDelete,
  onReplaceMedia,
  onRemoveMedia,
}: Props) => {
  const [priority, setPriority] = useState(String(event.priority))
  const [sortOrder, setSortOrder] = useState(String(event.sort_order))
  const titleId = `novelty-title-${event.id}`
  const status = STATUS_META[event.status]
  const orderDirty =
    toNumber(priority, event.priority) !== event.priority ||
    toNumber(sortOrder, event.sort_order) !== event.sort_order
  const moveHint = filtersActive
    ? "El reordenamiento se desactiva mientras hay búsqueda o filtros activos."
    : "Las flechas sólo mueven dentro del mismo grupo de prioridad."

  useEffect(() => {
    setPriority(String(event.priority))
    setSortOrder(String(event.sort_order))
  }, [event.id, event.priority, event.sort_order])

  return (
    <article
      data-testid={`novelty-card-${event.id}`}
      aria-labelledby={titleId}
      className={`bg-ui-bg-base flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-elevation-card-rest transition-shadow ${
        highlighted ? "border-ui-border-interactive ring-ui-border-interactive ring-2" : "border-ui-border-base"
      }`}
    >
      <div className="bg-ui-bg-subtle relative">
        <div className="h-40 w-full">
          {event.media_url && event.media_type === "video" ? (
            <video
              data-testid={`novelty-preview-${event.id}`}
              aria-label={`Vista previa de novedad: ${event.title}`}
              src={event.media_url}
              muted
              loop
              playsInline
              controls
              preload="metadata"
              className="h-full w-full bg-black object-contain"
            />
          ) : event.media_url ? (
            <img
              data-testid={`novelty-preview-${event.id}`}
              src={event.media_url}
              alt={`Vista previa de novedad: ${event.title}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-ui-fg-muted flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
              <Text size="small" weight="plus">
                Sin multimedia
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Añade una imagen, GIF o vídeo para que aparezca en el carrusel.
              </Text>
            </div>
          )}
        </div>

        <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1">
          <Badge size="2xsmall" color="grey">{`#${position}`}</Badge>
          {event.media_type ? (
            <Badge size="2xsmall" color={MEDIA_COLOR[event.media_type]}>
              {MEDIA_LABEL[event.media_type]}
            </Badge>
          ) : (
            <Badge size="2xsmall" color="grey">
              sin medio
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-y-3 p-4">
        <div className="min-w-0">
          <Heading level="h3" id={titleId} className="text-base leading-snug">
            {event.title}
          </Heading>
          <Text size="xsmall" className="text-ui-fg-subtle mt-0.5 truncate">
            {event.title_en || "Sin título EN"}
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Badge size="2xsmall" color={status.color}>
            {status.label}
          </Badge>
          <Badge size="2xsmall" color={event.enabled ? "green" : "grey"}>
            {event.enabled ? "Activa" : "Inactiva"}
          </Badge>
          <Badge data-testid={`novelty-store-state-${event.id}`} size="2xsmall" color={store.visible ? "green" : "grey"}>
            {store.visible ? "En Store" : "Fuera de Store"}
          </Badge>
        </div>

        <Text size="xsmall" className="text-ui-fg-subtle">
          {store.reason}
        </Text>

        <div className="border-ui-border-base grid grid-cols-1 gap-2 rounded-md border p-2.5">
          <div className="min-w-0">
            <Text size="xsmall" className="text-ui-fg-subtle uppercase">
              Slug y vigencia
            </Text>
            <Text size="small" className="truncate font-mono">
              /{event.slug}
            </Text>
            <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
              {formatWindow(event)}
            </Text>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-ui-fg-subtle text-xs" htmlFor={`novelty-priority-${event.id}`}>
              Prioridad
            </label>
            <Input
              id={`novelty-priority-${event.id}`}
              type="number"
              min={0}
              max={1000}
              aria-label={`Prioridad de ${event.title}`}
              value={priority}
              disabled={busy}
              onChange={(changeEvent) => setPriority(changeEvent.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-ui-fg-subtle text-xs" htmlFor={`novelty-order-${event.id}`}>
              Orden
            </label>
            <Input
              id={`novelty-order-${event.id}`}
              type="number"
              min={0}
              aria-label={`Orden de ${event.title}`}
              value={sortOrder}
              disabled={busy}
              onChange={(changeEvent) => setSortOrder(changeEvent.target.value)}
              className="w-20"
            />
          </div>
          <Button
            size="small"
            variant="secondary"
            isLoading={busy}
            disabled={!orderDirty}
            onClick={() =>
              onSaveOrder({
                priority: toNumber(priority, event.priority),
                sort_order: toNumber(sortOrder, event.sort_order),
              })
            }
          >
            Guardar orden
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="small"
            variant="secondary"
            aria-label={`Subir ${event.title}`}
            title={moveHint}
            disabled={busy || !canMoveUp}
            onClick={() => onMove(-1)}
          >
            Subir
          </Button>
          <Button
            size="small"
            variant="secondary"
            aria-label={`Bajar ${event.title}`}
            title={moveHint}
            disabled={busy || !canMoveDown}
            onClick={() => onMove(1)}
          >
            Bajar
          </Button>
        </div>

        <div className="border-ui-border-base flex flex-col gap-2 border-t pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-ui-fg-subtle text-xs" htmlFor={`novelty-media-${event.id}`}>
              {event.media_file_id ? "Reemplazar multimedia" : "Añadir multimedia"}
            </label>
            <Input
              id={`novelty-media-${event.id}`}
              type="file"
              accept={NOVELTY_MEDIA_ACCEPT}
              aria-label={`Multimedia de ${event.title}`}
              disabled={busy}
              onClick={(changeEvent) => {
                changeEvent.currentTarget.value = ""
              }}
              onChange={(changeEvent) => {
                const file = changeEvent.target.files?.[0]
                if (file) onReplaceMedia(file)
              }}
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              PNG/JPEG/WebP hasta 5 MB; GIF, MP4 o WebM hasta 100 MB.
            </Text>
            {busy && (
              <Text size="xsmall" role="status" className="text-ui-fg-subtle">
                Procesando cambio…
              </Text>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" disabled={busy} onClick={onEdit}>
              Editar novedad
            </Button>
            <Button asChild size="small" variant="secondary">
              <a href={`/app/jovy/events?event=${encodeURIComponent(event.id)}`}>Editar este evento</a>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {event.status !== "published" && (
              <Button size="small" variant="secondary" disabled={busy} onClick={onPublish}>
                Publicar
              </Button>
            )}
            {event.status !== "archived" && (
              <Button size="small" variant="secondary" disabled={busy} onClick={onArchive}>
                Archivar
              </Button>
            )}
            <Button size="small" variant="secondary" disabled={busy} onClick={onToggleEnabled}>
              {event.enabled ? "Desactivar" : "Activar"}
            </Button>
            <Button
              size="small"
              variant="danger"
              disabled={busy || !event.media_file_id}
              onClick={onRemoveMedia}
            >
              Retirar medio
            </Button>
            <Button size="small" variant="danger" disabled={busy} onClick={onDelete}>
              Eliminar
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}
