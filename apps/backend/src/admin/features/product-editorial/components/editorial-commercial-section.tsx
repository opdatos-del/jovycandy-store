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
    <section aria-labelledby="editorial-commercial-heading" className="border-ui-border-base rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading id="editorial-commercial-heading" level="h3">
          Modalidad comercial
        </Heading>
        <Badge color={commercialBadge.color} data-testid="commercial-mode-badge">
          {commercialBadge.label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[210px] flex-1">
          <label htmlFor="editorial-commercial-mode" className={labelClass}>
            Modalidad comercial
          </label>
          <select
            id="editorial-commercial-mode"
            aria-label="Modalidad comercial"
            className={`${selectClass} mt-1 w-full`}
            value={draft.commercial_mode}
            disabled={saving}
            onChange={(event) => void onChangeMode(event.target.value as CommercialMode)}
          >
            <option value="catalog_only">Informativo (solo catálogo)</option>
            <option value="sellable">Vendible</option>
          </select>
        </div>
      </div>

      <div className="mt-2" aria-live="polite">
        {isLegacyUnclassified ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Ficha histórica sin clasificar: se trata como informativa.
          </Text>
        ) : draft.commercial_mode === "sellable" ? (
          sellableRequirements.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Text size="xsmall" className="text-ui-fg-subtle">
                Pendiente:
              </Text>
              {sellableRequirements.map((code) => (
                <Badge key={code} size="2xsmall" color="orange">
                  {SELLABLE_REQUIREMENT_LABELS[code] ?? code}
                </Badge>
              ))}
            </div>
          ) : (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Requisitos comerciales completos; la venta la valida el servidor.
            </Text>
          )
        ) : (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Visible en catálogo, sin carrito ni compra.
          </Text>
        )}
      </div>
    </section>
  )
}
