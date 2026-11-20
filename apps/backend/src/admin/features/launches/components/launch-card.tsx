import { Badge, Button, Text } from "@medusajs/ui"
import type { Launch, ProductOption } from "../types"

type Props = {
  launch: Launch
  /** Posición en el orden global que consume Store. */
  index: number
  isFirst: boolean
  isLast: boolean
  product?: ProductOption
  reordering: boolean
  changing: boolean
  deleting: boolean
  onMove: (direction: -1 | 1) => void
  onToggleActive: () => void
  onEdit: () => void
  onDelete: () => void
  canUpdate: boolean
  canDelete: boolean
}

/**
 * Tarjeta de lanzamiento. Muestra la imagen resuelta por el servidor y cae a la
 * miniatura del producto cuando el lanzamiento no tiene imagen propia.
 */
export const LaunchCard = ({
  launch,
  index,
  isFirst,
  isLast,
  product,
  reordering,
  changing,
  deleting,
  onMove,
  onToggleActive,
  onEdit,
  onDelete,
  canUpdate,
  canDelete,
}: Props) => {
  const previewUrl = launch.image_resolved_url ?? product?.thumbnail ?? null

  return (
    <li
      data-testid={`launch-item-${launch.id}`}
      className="jovy-container border-ui-border-base bg-ui-bg-base flex min-w-0 max-w-[20rem] flex-col overflow-hidden rounded-lg border"
    >
      <div className="bg-ui-bg-subtle aspect-[4/3] overflow-hidden">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Imagen de ${launch.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <Text size="small" className="text-ui-fg-subtle">Sin imagen</Text>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-y-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Text weight="plus" className="line-clamp-2">
              {launch.title}
            </Text>
            <Badge color={launch.active ? "green" : "grey"}>
              {launch.active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          {launch.description && (
            <Text size="small" className="text-ui-fg-subtle mt-2 line-clamp-2">
              {launch.description}
            </Text>
          )}
          <Text size="xsmall" className="text-ui-fg-subtle mt-2 line-clamp-1">
            {product ? `Producto: ${product.title}` : launch.product_id ? `Producto: ${launch.product_id}` : "Imagen propia"}
          </Text>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Text size="xsmall" className="text-ui-fg-subtle">Orden {index + 1}</Text>
          {canUpdate && (
            <div className="flex items-center gap-1">
              <Button
                size="small"
                variant="secondary"
                aria-label={`Subir ${launch.title}`}
                disabled={isFirst || reordering}
                onClick={() => onMove(-1)}
              >
                Subir
              </Button>
              <Button
                size="small"
                variant="secondary"
                aria-label={`Bajar ${launch.title}`}
                disabled={isLast || reordering}
                onClick={() => onMove(1)}
              >
                Bajar
              </Button>
            </div>
          )}
        </div>
        <div className="jovy-actions jovy-actions--end-danger mt-auto flex flex-wrap gap-2">
          {canUpdate && (
            <Button
              size="small"
              variant="secondary"
              isLoading={changing}
              disabled={deleting || reordering}
              onClick={onToggleActive}
            >
              {launch.active ? "Desactivar" : "Activar"}
            </Button>
          )}
          {canUpdate && (
            <Button
              size="small"
              variant="secondary"
              aria-label={`Editar ${launch.title}`}
              onClick={onEdit}
            >
              Editar
            </Button>
          )}
          {canDelete && (
            <Button size="small" variant="danger" isLoading={deleting} disabled={changing || reordering} onClick={onDelete}>
              Eliminar
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
