import { Badge, Button, DropdownMenu, Input, Text } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import {
  MEDIA_COLOR,
  NOVELTY_MEDIA_ACCEPT,
  STATUS_META,
  formatWindow,
  type NoveltyEvent,
  type NoveltyMediaType,
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

/** Etiquetas legibles del medio; el valor crudo de la API no se muestra al editor. */
const MEDIA_TITLE: Record<NoveltyMediaType, string> = {
  image: "Imagen",
  gif: "GIF",
  video: "Vídeo",
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
  const mediaInput = useRef<HTMLInputElement>(null)
  const titleId = `novelty-title-${event.id}`
  const status = STATUS_META[event.status]
  const mediaLabel = event.media_type ? MEDIA_TITLE[event.media_type] : "Sin medio"
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
      className={`jovy-container bg-ui-bg-base flex min-w-0 flex-col rounded-md border p-3 shadow-elevation-card-rest transition-shadow ${
        highlighted ? "border-ui-border-interactive ring-ui-border-interactive ring-2" : "border-ui-border-base"
      }`}
    >
      <div className="bg-ui-bg-subtle relative mb-3 aspect-[16/9] max-h-40 overflow-hidden rounded">
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
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-ui-fg-muted flex h-full items-center justify-center px-3 text-center">
            <Text size="xsmall" weight="plus">
              Sin multimedia
            </Text>
          </div>
        )}

        <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1">
          <Badge size="2xsmall" color="grey">{`#${position}`}</Badge>
          <Badge
            size="2xsmall"
            color={event.media_type ? MEDIA_COLOR[event.media_type] : "grey"}
          >
            {mediaLabel}
          </Badge>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-y-2">
        <div className="min-w-0">
          <h3 id={titleId} className="truncate text-base leading-snug font-medium">
            {event.title}
          </h3>
          <Text size="xsmall" className="text-ui-fg-subtle truncate">
            {event.title_en || "Sin título EN"}
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Badge size="2xsmall" color={status.color}>
            {status.label}
          </Badge>
          <Badge data-testid={`novelty-store-state-${event.id}`} size="2xsmall" color={store.visible ? "green" : "grey"}>
            {store.visible ? "En Store" : "Fuera de Store"}
          </Badge>
        </div>

        {/* El motivo sólo ocupa espacio cuando explica una ausencia; si la novedad
            está publicada, ese mismo dato vive plegado en «Detalles». */}
        {!store.visible && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {store.reason}
          </Text>
        )}

        <details className="jovy-card-details">
          <summary className="text-ui-fg-subtle w-fit cursor-pointer text-xs">Detalles</summary>
          <div className="mt-2 flex flex-col gap-2">
            <dl className="text-ui-fg-subtle grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="col-span-2 flex min-w-0 items-baseline gap-1">
                <dt className="shrink-0">Slug: </dt>
                <dd className="min-w-0 truncate font-mono">/{event.slug}</dd>
              </div>
              <div className="col-span-2">
                <dt className="inline">Vigencia: </dt>
                <dd className="inline font-medium">{formatWindow(event)}</dd>
              </div>
              <div>
                <dt className="inline">Estado: </dt>
                <dd className="inline font-medium">{event.enabled ? "Activa" : "Inactiva"}</dd>
              </div>
              {store.visible && (
                <div>
                  <dt className="inline">Store: </dt>
                  <dd className="inline font-medium">{store.reason}</dd>
                </div>
              )}
            </dl>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex min-w-0 flex-col gap-1">
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
                  className="w-full"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
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
                  className="w-full"
                />
              </div>
            </div>
            <Button
              size="small"
              variant="secondary"
              isLoading={busy}
              disabled={!orderDirty}
              className="w-full"
              onClick={() =>
                onSaveOrder({
                  priority: toNumber(priority, event.priority),
                  sort_order: toNumber(sortOrder, event.sort_order),
                })
              }
            >
              Guardar orden
            </Button>
            <Text size="xsmall" id={`novelty-media-help-${event.id}`} className="text-ui-fg-subtle">
              PNG/JPEG/WebP hasta 5 MB; GIF, MP4 o WebM hasta 100 MB.
            </Text>
          </div>
        </details>

        <div className="jovy-actions border-ui-border-base mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          <Button size="small" variant="secondary" disabled={busy} onClick={onEdit}>
            Editar novedad
          </Button>
          {event.status !== "published" && (
            <Button size="small" variant="secondary" disabled={busy} onClick={onPublish}>
              Publicar
            </Button>
          )}
          {busy && (
            <Text size="xsmall" role="status" className="text-ui-fg-subtle">
              Procesando cambio…
            </Text>
          )}

          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button
                size="small"
                variant="secondary"
                aria-label={`Más acciones para ${event.title}`}
                data-testid={`novelty-actions-${event.id}`}
                disabled={busy}
              >
                Más
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item
                aria-label={`Subir ${event.title}`}
                title={moveHint}
                disabled={busy || !canMoveUp}
                onSelect={() => onMove(-1)}
              >
                Subir
              </DropdownMenu.Item>
              <DropdownMenu.Item
                aria-label={`Bajar ${event.title}`}
                title={moveHint}
                disabled={busy || !canMoveDown}
                onSelect={() => onMove(1)}
              >
                Bajar
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              {event.status !== "archived" && (
                <DropdownMenu.Item disabled={busy} onSelect={onArchive}>
                  Archivar
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item disabled={busy} onSelect={onToggleEnabled}>
                {event.enabled ? "Desactivar" : "Activar"}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                aria-label={`Multimedia de ${event.title}`}
                aria-describedby={`novelty-media-help-${event.id}`}
                disabled={busy}
                onSelect={(selectEvent) => {
                  // Radix cierra el menú y devuelve el foco al disparador; se evita
                  // para que el diálogo nativo de archivos conserve el gesto.
                  selectEvent.preventDefault()
                  mediaInput.current?.click()
                }}
              >
                {event.media_file_id ? "Reemplazar multimedia" : "Añadir multimedia"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                disabled={busy || !event.media_file_id}
                onSelect={onRemoveMedia}
              >
                Retirar medio
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                className="text-ui-fg-error"
                disabled={busy}
                onSelect={onDelete}
              >
                Eliminar
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>

          <input
            ref={mediaInput}
            id={`novelty-media-${event.id}`}
            type="file"
            accept={NOVELTY_MEDIA_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            aria-describedby={`novelty-media-help-${event.id}`}
            disabled={busy}
            onClick={(changeEvent) => {
              changeEvent.currentTarget.value = ""
            }}
            onChange={(changeEvent) => {
              const file = changeEvent.target.files?.[0]
              if (file) onReplaceMedia(file)
            }}
          />
        </div>
      </div>
    </article>
  )
}
