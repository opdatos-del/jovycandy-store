import { Button, Container, Input, Text } from "@medusajs/ui"
import type { NoveltyFilters } from "../model"

type Props = {
  filters: NoveltyFilters
  filtersActive: boolean
  filteredCount: number
  eventsCount: number
  onChange: (patch: Partial<NoveltyFilters>) => void
  onClear: () => void
}

const statusFilterOptions: Array<{ value: NoveltyFilters["status"]; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "published", label: "Publicadas" },
  { value: "draft", label: "Borradores" },
  { value: "archived", label: "Archivadas" },
  { value: "cancelled", label: "Canceladas" },
]

const mediaFilterOptions: Array<{ value: NoveltyFilters["media"]; label: string }> = [
  { value: "all", label: "Todos los medios" },
  { value: "image", label: "Imagen" },
  { value: "gif", label: "GIF" },
  { value: "video", label: "Vídeo" },
  { value: "none", label: "Sin multimedia" },
]

const activeFilterOptions: Array<{ value: NoveltyFilters["active"]; label: string }> = [
  { value: "all", label: "Activas e inactivas" },
  { value: "yes", label: "Sólo activas" },
  { value: "no", label: "Sólo inactivas" },
]

const selectClass =
  "border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive w-full rounded-md border px-2 py-1.5 text-sm outline-hidden focus-visible:ring-2"

/** Filtros de la bandeja y contador de resultados visibles. */
export const NoveltiesFilters = ({
  filters,
  filtersActive,
  filteredCount,
  eventsCount,
  onChange,
  onClear,
}: Props) => (
  <Container className="p-6">
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-56 flex-1 flex-col gap-1">
        <label htmlFor="novelty-search" className="text-ui-fg-subtle text-xs font-medium">
          Buscar novedad
        </label>
        <Input
          id="novelty-search"
          type="search"
          placeholder="Título, título EN o slug"
          value={filters.search}
          onChange={(changeEvent) => onChange({ search: changeEvent.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="novelty-status-filter" className="text-ui-fg-subtle text-xs font-medium">
          Estado
        </label>
        <select
          id="novelty-status-filter"
          className={selectClass}
          value={filters.status}
          onChange={(changeEvent) =>
            onChange({ status: changeEvent.target.value as NoveltyFilters["status"] })
          }
        >
          {statusFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="novelty-media-filter" className="text-ui-fg-subtle text-xs font-medium">
          Tipo de medio
        </label>
        <select
          id="novelty-media-filter"
          className={selectClass}
          value={filters.media}
          onChange={(changeEvent) =>
            onChange({ media: changeEvent.target.value as NoveltyFilters["media"] })
          }
        >
          {mediaFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="novelty-active-filter" className="text-ui-fg-subtle text-xs font-medium">
          Actividad
        </label>
        <select
          id="novelty-active-filter"
          className={selectClass}
          value={filters.active}
          onChange={(changeEvent) =>
            onChange({ active: changeEvent.target.value as NoveltyFilters["active"] })
          }
        >
          {activeFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {filtersActive && (
        <Button size="small" variant="secondary" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <Text size="small" role="status" className="text-ui-fg-subtle">
        Mostrando {filteredCount} de {eventsCount} novedades.
      </Text>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Orden de Store: prioridad descendente y después orden ascendente. Reordenar se desactiva con filtros activos.
      </Text>
    </div>
  </Container>
)
