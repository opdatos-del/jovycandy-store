import { Heading, Text } from "@medusajs/ui"
import type { ProductEditorial } from "../types"

type EditorialCatalogueSectionProps = {
  editorial: ProductEditorial | null
}

/**
 * Familia y categorías son informativas: se resuelven desde el producto
 * comercial para no duplicar el Product Module.
 */
export const EditorialCatalogueSection = ({ editorial }: EditorialCatalogueSectionProps) => (
  <section aria-labelledby="editorial-catalogue-heading" className="border-ui-border-base rounded-lg border p-4">
    <Heading id="editorial-catalogue-heading" level="h3">Relación con catálogo</Heading>
    <Text size="small" className="text-ui-fg-subtle mt-1">Familia y categorías se resuelven desde el producto comercial; aquí son informativas para evitar duplicar Product Module.</Text>
    <div className="mt-3 flex flex-col gap-y-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
      <span><strong>Familia:</strong> {editorial?.family?.name ?? "Sin familia"}</span>
      <span><strong>Categorías:</strong> {editorial?.category_keys.length ? editorial.category_keys.join(", ") : "Sin categoría de presentación"}</span>
      <a href="/app/jovy/catalogue" className="text-ui-fg-interactive underline">Ver relación de familia y categorías</a>
    </div>
  </section>
)
