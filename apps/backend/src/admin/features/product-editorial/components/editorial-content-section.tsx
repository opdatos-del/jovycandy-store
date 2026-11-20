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
  <section aria-labelledby="editorial-content-heading" className="border-ui-border-base rounded-lg border p-4">
    <Heading id="editorial-content-heading" level="h3">Presentación editorial</Heading>
    <Text size="xsmall" className="text-ui-fg-subtle mt-1">Campos visibles en el catálogo editorial; no sustituyen la información comercial.</Text>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
      <div className="flex flex-col gap-y-1">
        <label htmlFor="editorial-gramaje" className={labelClass}>Gramaje</label>
        <Input id="editorial-gramaje" maxLength={50} placeholder="250 g" value={draft.gramaje} onChange={(event) => onUpdate({ gramaje: event.target.value })} />
        <Text size="xsmall" className="text-ui-fg-subtle">Texto corto opcional, máximo 50 caracteres.</Text>
      </div>
      <div className="flex flex-col gap-y-1">
        <label htmlFor="editorial-sort-order" className={labelClass}>Orden</label>
        <Input id="editorial-sort-order" type="number" min={0} step={1} value={draft.sort_order} onChange={(event) => onUpdate({ sort_order: event.target.value })} />
        <Text size="xsmall" className="text-ui-fg-subtle">Menor aparece antes.</Text>
      </div>
    </div>
    <fieldset className="mt-4 flex flex-col gap-y-2">
      <legend className={labelClass}>Certificaciones</legend>
      <Text size="xsmall" className="text-ui-fg-subtle">Selecciona una o varias del catálogo permitido por servidor.</Text>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {CERTIFICATIONS.map((certification) => (
          <label key={certification} className="flex min-h-6 items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={draft.certifications.includes(certification)} onChange={(event) => onToggleCertification(certification, event.target.checked)} />
            {certification}
          </label>
        ))}
      </div>
    </fieldset>
    <div className="mt-4 flex items-center gap-2">
      <Switch id="editorial-is-new" aria-label="Novedad" checked={draft.is_new} onCheckedChange={(checked) => onUpdate({ is_new: checked })} />
      <label htmlFor="editorial-is-new" className="text-sm font-medium">Marcar como novedad</label>
    </div>
  </section>
)
