import { Badge, Heading, Text } from "@medusajs/ui"
import { useMemo } from "react"
import {
  formatGroupRange,
  formatInstant,
  formatWindow,
  galleryTitle,
  isVisibleNow,
  maxSimultaneous,
  overlappingWindowGroups,
  publicationState,
  windowStart,
} from "../model"
import { MAX_VISIBLE_GALLERY_ITEMS, type GalleryItem } from "../types"

/**
 * Aviso de agenda calculado solo con los datos que ya devuelve la lista.
 * El backend acepta más de cuatro filas: el cupo es de simultaneidad, así que
 * aquí se distingue "visible ahora" de "publicado" y de "borrador".
 */
export const GalleryAgenda = ({ items }: { items: GalleryItem[] }) => {
  const summary = useMemo(() => {
    const now = Date.now()
    const visible = items.filter((item) => isVisibleNow(item, now))
    const scheduled = items
      .filter((item) => publicationState(item, now) === "scheduled")
      .sort((left, right) => windowStart(left) - windowStart(right))
    const groups = overlappingWindowGroups(items)
    return {
      visible,
      scheduled,
      groups,
      peak: maxSimultaneous(items),
      drafts: items.filter((item) => item.status === "draft").length,
      archived: items.filter((item) => item.status === "archived").length,
      titles: new Map(items.map((item) => [item.id, galleryTitle(item)])),
    }
  }, [items])

  const full = summary.peak >= MAX_VISIBLE_GALLERY_ITEMS

  return <section
    className="jovy-card jovy-container border-ui-border-base bg-ui-bg-base rounded-lg border p-4"
    aria-labelledby="gallery-agenda-heading"
    data-testid="gallery-agenda"
  >
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <Heading level="h3" id="gallery-agenda-heading">Agenda de cupo</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1" data-testid="gallery-quota-limit">
          Límite del backend: {MAX_VISIBLE_GALLERY_ITEMS} elementos publicados y activos en el mismo instante,
          no {MAX_VISIBLE_GALLERY_ITEMS} filas en total.
        </Text>
      </div>
      {full && <Badge color="orange">Cupo ocupado en algún periodo</Badge>}
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="border-ui-border-base bg-ui-bg-subtle rounded-md border p-3">
        <Text size="xsmall" className="text-ui-fg-subtle uppercase">Visibles ahora</Text>
        <p className="mt-1 text-2xl font-semibold tabular-nums" data-testid="gallery-quota-now">
          {summary.visible.length} de {MAX_VISIBLE_GALLERY_ITEMS}
        </p>
        <div
          className="mt-2 flex gap-1"
          role="progressbar"
          aria-label="Cupo visible ahora"
          aria-valuemin={0}
          aria-valuemax={MAX_VISIBLE_GALLERY_ITEMS}
          aria-valuenow={summary.visible.length}
        >
          {Array.from({ length: MAX_VISIBLE_GALLERY_ITEMS }, (_, index) => <span
            key={index}
            className={`h-2 flex-1 rounded-full ${
              index < summary.visible.length ? "bg-green-500" : "bg-ui-bg-component"
            }`}
          />)}
        </div>
      </div>
      <div className="border-ui-border-base bg-ui-bg-subtle rounded-md border p-3">
        <Text size="xsmall" className="text-ui-fg-subtle uppercase">Pico programado</Text>
        <p className="mt-1 text-2xl font-semibold tabular-nums" data-testid="gallery-quota-peak">
          {summary.peak} de {MAX_VISIBLE_GALLERY_ITEMS}
        </p>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          Máximo simultáneo entre todas las ventanas.
        </Text>
      </div>
      <div className="border-ui-border-base bg-ui-bg-subtle rounded-md border p-3">
        <Text size="xsmall" className="text-ui-fg-subtle uppercase">Borradores</Text>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.drafts}</p>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">No consumen cupo.</Text>
      </div>
      <div className="border-ui-border-base bg-ui-bg-subtle rounded-md border p-3">
        <Text size="xsmall" className="text-ui-fg-subtle uppercase">Archivados</Text>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.archived}</p>
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">Fuera de Store y del cupo.</Text>
      </div>
    </div>

    <div className="jovy-container mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <Text size="small" weight="plus">Ocupan cupo ahora</Text>
        {summary.visible.length === 0
          ? <p className="text-ui-fg-subtle mt-2 text-sm">Ningún elemento está visible en este momento.</p>
          : <ul className="mt-2 flex flex-col gap-2" data-testid="gallery-quota-occupants">
            {summary.visible.map((item) => <li
              key={item.id}
              className="jovy-container bg-ui-bg-component rounded-md px-3 py-2"
            >
              <p className="truncate text-sm font-medium">{galleryTitle(item)}</p>
              <p className="text-ui-fg-subtle text-xs">{formatWindow(item)}</p>
            </li>)}
          </ul>}
      </div>
      <div>
        <Text size="small" weight="plus">Ventanas que solapan</Text>
        {summary.groups.length === 0
          ? <p className="text-ui-fg-subtle mt-2 text-sm">
            Ningún par de elementos publicados y activos comparte periodo.
          </p>
          : <ul className="mt-2 flex flex-col gap-2" data-testid="gallery-window-overlaps">
            {summary.groups.slice(0, 3).map((group) => <li
              key={group.ids.join("-")}
              className="jovy-container bg-ui-bg-component rounded-md px-3 py-2"
            >
              <p className="jovy-wrap-text text-sm font-medium">
                {group.ids.map((id) => summary.titles.get(id) ?? "Sin título").join(" ∩ ")}
              </p>
              <p className="text-ui-fg-subtle text-xs">{formatGroupRange(group)}</p>
            </li>)}
            {summary.groups.length > 3 && <li className="text-ui-fg-subtle text-xs">
              +{summary.groups.length - 3} grupos más con solape.
            </li>}
          </ul>}
      </div>
    </div>

    {summary.scheduled.length > 0 && <div className="mt-4">
      <Text size="small" weight="plus">Próximas ventanas</Text>
      <ul className="mt-2 flex flex-col gap-1" data-testid="gallery-scheduled-windows">
        {summary.scheduled.slice(0, 3).map((item) => <li key={item.id} className="text-ui-fg-subtle text-sm">
          <span className="text-ui-fg-base font-medium">{galleryTitle(item)}</span>{" · "}
          comienza {formatInstant(windowStart(item))}
        </li>)}
      </ul>
    </div>}
  </section>
}
