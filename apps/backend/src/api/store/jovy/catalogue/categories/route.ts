import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { compareCatalogueOrder, normalizeCatalogueInteraction } from "@jovy/lib/jovy/catalogue"
import { resolveFileUrl } from "@jovy/lib/jovy/media"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

/**
 * Solo se publican tarjetas efectivamente `active`. Una fila histórica con
 * `active = true` y `coming_soon = true` se interpreta como no publicada,
 * igual que las nuevas escrituras normalizadas.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CATALOGUE_MODULE)
  const files = req.scope.resolve(Modules.FILE)
  const categories = (await service.listCatalogueCategories({ active: true }, {
    order: { sort_order: "ASC", created_at: "ASC" },
  }))
    .map((category) => ({ ...category, ...normalizeCatalogueInteraction(category) }))
    .filter((category) => category.active)
    .sort(compareCatalogueOrder)

  res.json({
    categories: await Promise.all(categories.map(async (category) => ({
      id: category.id,
      key: category.key,
      name: category.name,
      description: category.description,
      sort_order: category.sort_order,
      active: category.active,
      coming_soon: category.coming_soon,
      interaction_locked: category.interaction_locked,
      image_file_id: category.image_file_id,
      image_url: (await resolveFileUrl(files, category.image_file_id)) ?? category.image_url,
      medusa_category_id: category.medusa_category_id,
    }))),
  })
}
