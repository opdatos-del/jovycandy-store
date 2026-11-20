import { ArrowDownMini, ArrowUpMini } from "@medusajs/icons"
import { Badge, Button, DropdownMenu } from "@medusajs/ui"
import {
  formatWindow,
  galleryTitle,
  publicationColor,
  publicationLabel,
  publicationState,
  statusColor,
  statusLabel,
} from "../model"
import type { GalleryItem, GalleryStatus } from "../types"

type Props = {
  item: GalleryItem
  index: number
  total: number
  /** Cualquier operación en curso sobre la fila o reordenamiento global. */
  busy: boolean
  /** Operación concreta sobre esta fila; controla el spinner de publicar/despublicar. */
  pending: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onOpenLightbox: () => void
  onEdit: () => void
  onChangeStatus: (status: GalleryStatus) => void
  onToggleEnabled: () => void
  onRemove: () => void
  canUpdate: boolean
  canDelete: boolean
  canPublish: boolean
  canArchive: boolean
}

/**
 * Fila de la lista de galería: orden, miniatura ampliable, estado editorial y
 * acciones de ciclo de vida. Conserva testids, etiquetas accesibles y clases.
 */
export const GalleryCard = ({
  item,
  index,
  total,
  busy,
  pending,
  onMove,
  onOpenLightbox,
  onEdit,
  onChangeStatus,
  onToggleEnabled,
  onRemove,
  canUpdate,
  canDelete,
  canPublish,
  canArchive,
}: Props) => {
  const title = galleryTitle(item)
  const state = publicationState(item)

  return <li
    data-testid={`gallery-item-${item.id}`}
    className="jovy-container jovy-gallery-row grid gap-3 px-3 py-3"
    aria-busy={busy}
  >
    <div className="flex items-center gap-2 md:flex-col md:items-start">
      <span className="text-ui-fg-subtle text-xs font-medium uppercase md:hidden">Orden</span>
      <span className="text-sm font-medium tabular-nums">{index + 1}</span>
      <div className="flex items-center gap-1">
        {canUpdate && (
          <>
            <Button
              size="small"
              variant="secondary"
              className="jovy-icon-button h-7 w-7 p-0"
              aria-label={`Subir ${title}`}
              onClick={() => onMove(index, -1)}
              disabled={busy || index === 0}
            >
              <ArrowUpMini />
            </Button>
            <Button
              size="small"
              variant="secondary"
              className="jovy-icon-button h-7 w-7 p-0"
              aria-label={`Bajar ${title}`}
              onClick={() => onMove(index, 1)}
              disabled={busy || index === total - 1}
            >
              <ArrowDownMini />
            </Button>
          </>
        )}
      </div>
    </div>

    <div className="flex min-w-0 items-start gap-3">
      <button
        type="button"
        onClick={onOpenLightbox}
        disabled={!item.media_url}
        aria-label={`Ampliar ${title}`}
        className="border-ui-border-base bg-ui-bg-subtle focus-visible:ring-ui-border-interactive group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
      >
        {item.media_url
          ? <img
            src={item.media_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          : <span className="text-ui-fg-muted flex h-full items-center justify-center text-xs">Sin imagen</span>}
      </button>
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge color={statusColor(item.status)}>{statusLabel[item.status]}</Badge>
          {item.status === "published" && <Badge color={publicationColor(state)}>{publicationLabel[state]}</Badge>}
          <span className="text-ui-fg-subtle text-xs">{item.enabled ? "Activo" : "Inactivo"}</span>
        </div>
        {item.description && <p className="text-ui-fg-subtle mt-1 line-clamp-2 text-xs">{item.description}</p>}
        <p className="text-ui-fg-subtle mt-1 text-xs">{formatWindow(item)}</p>
      </div>
    </div>

    <div className="jovy-actions flex flex-wrap gap-2 md:justify-end">
      {canUpdate && (
        <Button
          size="small"
          variant="secondary"
          aria-label={`Editar ${title}`}
          onClick={onEdit}
          disabled={busy}
        >
          Editar
        </Button>
      )}
      {canPublish && (item.status === "published"
        ? <Button
          size="small"
          variant="secondary"
          aria-label={`Despublicar ${title}`}
          onClick={() => onChangeStatus("draft")}
          isLoading={pending}
        >
          Despublicar
        </Button>
        : <Button
          size="small"
          variant="secondary"
          aria-label={`Publicar ${title}`}
          onClick={() => onChangeStatus("published")}
          isLoading={pending}
        >
          Publicar
        </Button>)}
      {(canUpdate || canDelete || canArchive) && (
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            size="small"
            variant="secondary"
            aria-label={`Más acciones para ${title}`}
            data-testid={`gallery-item-actions-${item.id}`}
            disabled={busy}
          >
            Más
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {canArchive && item.status !== "archived" && <DropdownMenu.Item
            aria-label={`Archivar ${title}`}
            onSelect={() => onChangeStatus("archived")}
            disabled={busy}
          >
            Archivar
          </DropdownMenu.Item>}
          {canUpdate && (
            <DropdownMenu.Item
              aria-label={`${item.enabled ? "Desactivar" : "Activar"} ${title}`}
              onSelect={onToggleEnabled}
              disabled={busy}
            >
              {item.enabled ? "Desactivar" : "Activar"}
            </DropdownMenu.Item>
          )}
          {canDelete && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                className="text-ui-fg-error"
                aria-label={`Eliminar ${title}`}
                onSelect={onRemove}
                disabled={busy}
              >
                Eliminar
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
      )}
    </div>
  </li>
}
