import { PencilSquare, Photo } from "@medusajs/icons"
import { Badge, Button, DropdownMenu, Text } from "@medusajs/ui"
import {
  FREQUENCY_LABEL,
  ROTATION_DEFAULT,
  SLOT_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  WINDOW_COLOR,
  WINDOW_LABEL,
  formatDate,
  priorityLabel,
  vigenciaLabel,
  type Banner,
  type Status,
  type WindowState,
} from "../types"

export type BannerCardProps = {
  banner: Banner
  imageUrl: string | null
  state: WindowState
  busy: boolean
  reordering: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onEdit: (banner: Banner) => void
  onChangeStatus: (banner: Banner, next: Status) => void
  onMove: (banner: Banner, direction: -1 | 1) => void
  onRemove: (banner: Banner) => void
}

/** Tarjeta del listado: vista previa, insignias, vigencia, detalles y acciones. */
export const BannerCard = ({
  banner,
  imageUrl,
  state,
  busy,
  reordering,
  canMoveUp,
  canMoveDown,
  onEdit,
  onChangeStatus,
  onMove,
  onRemove,
}: BannerCardProps) => {
  const title = banner.translations.es.title

  return (
    <li
      data-testid={`banner-card-${banner.id}`}
      className="jovy-container flex min-w-0 flex-col rounded-md border border-ui-border-base bg-ui-bg-base p-3 shadow-elevation-card-rest"
    >
      <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded bg-ui-bg-subtle">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Vista previa de ${title}`}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
            <Photo aria-hidden className="text-ui-fg-muted h-6 w-6" />
            <Text size="xsmall" className="text-ui-fg-subtle">
              {banner.media_file_id ? "Imagen no disponible" : "Sin imagen"}
            </Text>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge color={banner.slot === "promo" ? "purple" : "blue"}>{SLOT_LABEL[banner.slot]}</Badge>
          <Badge color={STATUS_COLOR[banner.status]}>{STATUS_LABEL[banner.status]}</Badge>
          <Badge color={WINDOW_COLOR[state]} data-testid={`banner-window-${banner.id}`}>
            {WINDOW_LABEL[state]}
          </Badge>
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-medium">{title || "Sin título"}</h3>
          <Text size="xsmall" className="text-ui-fg-subtle line-clamp-1">
            {banner.translations.en.title || "Sin título EN"}
          </Text>
        </div>

        {banner.translations.es.description && (
          <Text size="small" className="text-ui-fg-subtle line-clamp-2">
            {banner.translations.es.description}
          </Text>
        )}

        <Text size="xsmall" className="text-ui-fg-subtle">
          {`Prioridad ${banner.priority} (${priorityLabel(banner.priority)}) · Orden ${banner.sort_order} · ${vigenciaLabel(banner)}`}
        </Text>

        <details className="jovy-card-details">
          <summary className="text-ui-fg-subtle w-fit cursor-pointer text-xs">Detalles</summary>
          <dl className="text-ui-fg-subtle mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="col-span-2">
              <dt className="inline">Duración: </dt>
              <dd className="inline font-medium">{banner.rotation_seconds ?? ROTATION_DEFAULT} s</dd>
            </div>
            {banner.slot === "promo" && (
              <div className="col-span-2">
                <dt className="inline">Frecuencia: </dt>
                <dd className="inline font-medium">{FREQUENCY_LABEL[banner.frequency]}</dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="inline">Ventana: </dt>
              <dd className="inline font-medium">
                {formatDate(banner.starts_at)} → {formatDate(banner.ends_at)}
              </dd>
            </div>
            {banner.cta_url && (
              <div className="col-span-2 min-w-0">
                <dt className="inline">CTA: </dt>
                <dd className="inline truncate font-mono">{banner.cta_url}</dd>
              </div>
            )}
            {banner.slot === "promo" && (
              <div>
                <dt className="inline">Auto-apertura: </dt>
                <dd className="inline font-medium">{banner.auto_open ? "Sí" : "No"}</dd>
              </div>
            )}
            <div>
              <dt className="inline">Estado: </dt>
              <dd className="inline font-medium">{banner.enabled ? "Habilitado" : "Deshabilitado"}</dd>
            </div>
          </dl>
        </details>

        <div className="jovy-actions jovy-actions--end-danger mt-auto flex flex-wrap gap-2 border-t border-ui-border-base pt-3">
          <Button
            size="small"
            variant="secondary"
            aria-label={`Editar ${title}`}
            onClick={() => onEdit(banner)}
            disabled={busy || reordering}
          >
            <PencilSquare />
            Editar
          </Button>

          {banner.status === "published" ? (
            <Button
              size="small"
              variant="secondary"
              aria-label={`Despublicar ${title}`}
              isLoading={busy}
              disabled={busy || reordering}
              onClick={() => onChangeStatus(banner, "draft")}
            >
              Despublicar
            </Button>
          ) : (
            <Button
              size="small"
              variant="secondary"
              aria-label={`Publicar ${title}`}
              isLoading={busy}
              disabled={busy || reordering || banner.status === "archived"}
              onClick={() => onChangeStatus(banner, "published")}
            >
              Publicar
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button
                size="small"
                variant="secondary"
                aria-label={`Más acciones para ${title}`}
                data-testid={`banner-actions-${banner.id}`}
                disabled={busy || reordering}
              >
                Más
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item
                aria-label={`Archivar ${title}`}
                disabled={busy || reordering || banner.status === "archived"}
                onSelect={() => onChangeStatus(banner, "archived")}
              >
                Archivar
              </DropdownMenu.Item>
              <DropdownMenu.Item
                aria-label={`Subir ${title}`}
                disabled={busy || reordering || !canMoveUp}
                onSelect={() => onMove(banner, -1)}
              >
                Subir
              </DropdownMenu.Item>
              <DropdownMenu.Item
                aria-label={`Bajar ${title}`}
                disabled={busy || reordering || !canMoveDown}
                onSelect={() => onMove(banner, 1)}
              >
                Bajar
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                className="text-ui-fg-error"
                aria-label={`Eliminar ${title}`}
                disabled={busy || reordering}
                onSelect={() => onRemove(banner)}
              >
                Eliminar
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>
    </li>
  )
}
