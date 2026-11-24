import { Badge, Heading, Text } from "@medusajs/ui"
import type { ProductEditorial } from "../types"

type EditorialCatalogueSectionProps = {
  editorial: ProductEditorial | null
}

/**
 * Familia y categorías son informativas: se resuelven desde el producto
 * comercial para no duplicar el Product Module.
 */
export const EditorialCatalogueSection = ({ editorial }: EditorialCatalogueSectionProps) => (
  <section aria-labelledby="editorial-catalogue-heading" className="border-ui-border-base rounded-lg border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Heading id="editorial-catalogue-heading" level="h3">
        Catálogo
      </Heading>
      <a href="/app/jovy/catalogue" className="text-ui-fg-interactive text-xs underline">
        Ver relación
      </a>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Badge size="2xsmall" color="grey">
        {editorial?.family?.name ?? "Sin familia"}
      </Badge>
      {editorial?.category_keys.length ? (
        editorial.category_keys.map((key) => (
          <Badge key={key} size="2xsmall" color="grey">
            {key}
          </Badge>
        ))
      ) : (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Sin categoría de presentación
        </Text>
      )}
    </div>
  </section>
)
