import { Heading, Input, Switch, Text } from "@medusajs/ui"
import { CERTIFICATIONS } from "../model"
import type { EditorialDraft } from "../types"
import { labelClass } from "./editorial-styles"

type EditorialContentSectionProps = {
  draft: EditorialDraft
  onUpdate: (patch: Partial<EditorialDraft>) => void
  onToggleCertification: (certification: string, checked: boolean) => void
}

/** Campos de presentación visibles en el catálogo editorial. */
export const EditorialContentSection = ({
  draft,
  onUpdate,
  onToggleCertification,
}: EditorialContentSectionProps) => (
  <section aria-labelledby="editorial-content-heading" className="border-ui-border-base rounded-lg border p-3">
    <Heading id="editorial-content-heading" level="h3">
      Presentación editorial
    </Heading>

    <div className="mt-3 grid grid-cols-2 gap-3">
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="editorial-gramaje" className={labelClass}>
          Gramaje
        </label>
        <Input
          id="editorial-gramaje"
          maxLength={50}
          placeholder="170 g"
          value={draft.gramaje}
          onChange={(event) => onUpdate({ gramaje: event.target.value })}
        />
        <Text size="xsmall" className="text-ui-fg-subtle mt-1">
          Usa gramos o kilos
        </Text>
      </div>
      <div>
        <label htmlFor="editorial-sort-order" className={labelClass}>
          Orden
        </label>
        <Input
          id="editorial-sort-order"
          type="number"
          min={0}
          step={1}
          value={draft.sort_order}
          onChange={(event) => onUpdate({ sort_order: event.target.value })}
        />
      </div>
      <div className="col-span-2 flex items-center justify-between gap-2 rounded-md border border-ui-border-base px-2.5 py-2">
        <label htmlFor="editorial-is-new" className="text-sm font-medium">
          Marcar como novedad
        </label>
        <Switch
          id="editorial-is-new"
          aria-label="Novedad"
          checked={draft.is_new}
          onCheckedChange={(checked) => onUpdate({ is_new: checked })}
        />
      </div>
    </div>

    <fieldset className="mt-3">
      <legend className={labelClass}>Certificaciones</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {CERTIFICATIONS.map((certification) => {
          const checked = draft.certifications.includes(certification)
          return (
            <label
              key={certification}
              className={`inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                checked
                  ? "border-ui-border-interactive bg-ui-bg-base text-ui-fg-base"
                  : "border-ui-border-base text-ui-fg-subtle"
              }`}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={checked}
                onChange={(event) => onToggleCertification(certification, event.target.checked)}
              />
              {certification}
            </label>
          )
        })}
      </div>
    </fieldset>
  </section>
)
