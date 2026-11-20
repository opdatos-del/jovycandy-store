import { Badge, Heading, Text } from "@medusajs/ui"
import { COMMERCIAL_MODE_BADGE, SELLABLE_REQUIREMENT_LABELS } from "../model"
import type { CommercialMode, EditorialDraft, ProductEditorial } from "../types"
import { labelClass, selectClass } from "./editorial-styles"

type EditorialCommercialSectionProps = {
  editorial: ProductEditorial | null
  draft: EditorialDraft
  saving: boolean
  onChangeMode: (mode: CommercialMode) => void | Promise<void>
}

/**
 * Modalidad comercial de la ficha. Solo registra la intención: no crea ni
 * modifica precios, stock ni el producto comercial nativo.
 */
export const EditorialCommercialSection = ({
  editorial,
  draft,
  saving,
  onChangeMode,
}: EditorialCommercialSectionProps) => {
  const commercialBadge = COMMERCIAL_MODE_BADGE[draft.commercial_mode]
  const isLegacyUnclassified = editorial?.commercial_mode == null
  const sellableRequirements = Array.isArray(editorial?.sellable_requirements)
    ? editorial.sellable_requirements
    : []

  return (
    <section aria-labelledby="editorial-commercial-heading" className="border-ui-border-base rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <Heading id="editorial-commercial-heading" level="h3">Modalidad comercial</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">Define si esta ficha es informativa o está autorizada para la venta. No crea ni modifica un producto comercial.</Text>
        </div>
        <Badge color={commercialBadge.color} data-testid="commercial-mode-badge">{commercialBadge.label}</Badge>
      </div>

      {isLegacyUnclassified && (
        <p role="note" className="border-ui-border-base bg-ui-bg-subtle text-ui-fg-base mt-3 rounded-md border p-3 text-sm">Producto histórico sin clasificar: se trata como informativo y no se vende hasta autorización expresa.</p>
      )}

      <div className="mt-4 flex flex-col gap-y-1">
        <label htmlFor="editorial-commercial-mode" className={labelClass}>Modalidad comercial</label>
        <select
          id="editorial-commercial-mode"
          aria-label="Modalidad comercial"
          className={selectClass}
          value={draft.commercial_mode}
          disabled={saving}
          onChange={(event) => void onChangeMode(event.target.value as CommercialMode)}
        >
          <option value="catalog_only">Informativo (solo catálogo)</option>
          <option value="sellable">Vendible</option>
        </select>
      </div>

      <div className="mt-4" aria-live="polite">
        {draft.commercial_mode === "sellable" ? (
          sellableRequirements.length > 0 ? (
            <div className="text-sm">
              <Text size="small" weight="plus">Requisitos pendientes para vender</Text>
              <ul className="mt-1 list-disc pl-5">
                {sellableRequirements.map((code) => <li key={code}>{SELLABLE_REQUIREMENT_LABELS[code] ?? code}</li>)}
              </ul>
            </div>
          ) : (
            <Text size="small" className="text-ui-fg-subtle">Requisitos comerciales completos según la información disponible; la venta sigue sujeta a validación del servidor.</Text>
          )
        ) : (
          <Text size="small" className="text-ui-fg-subtle">Este producto puede publicarse en el catálogo corporativo, pero no se puede añadir al carrito ni comprar.</Text>
        )}
      </div>
    </section>
  )
}
