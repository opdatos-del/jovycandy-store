import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { compareCatalogueOrder, normalizeCatalogueInteraction } from "@jovy/lib/jovy/catalogue"
import { resolveFileUrl } from "@jovy/lib/jovy/media"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { seedCatalogueCategoriesWorkflow } from "@jovy/workflows/jovy-catalogue/seed"

/**
 * No existe `POST /categories`: el conjunto de claves públicas es fijo y la
 * única vía de creación es este seed idempotente, que nunca pisa ediciones.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await seedCatalogueCategoriesWorkflow(req.scope).run({ input: {} })
  const service = req.scope.resolve(JOVY_CATALOGUE_MODULE)
  const files = req.scope.resolve(Modules.FILE)
  const categories = (await service.listCatalogueCategories({}, { order: { sort_order: "ASC", created_at: "ASC" } }))
    .sort(compareCatalogueOrder)

  res.json({
    created: result.created,
    categories: await Promise.all(categories.map(async (category) => ({
      ...category,
      ...normalizeCatalogueInteraction(category),
      image_resolved_url: (await resolveFileUrl(files, category.image_file_id)) ?? category.image_url,
    }))),
  })
}
