import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  catalogueCategoryKeySchema,
  compareCatalogueOrder,
  normalizeCatalogueInteraction,
} from "@jovy/lib/jovy/catalogue"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

/**
 * Familias activas, en orden de presentación. No expone identificadores de
 * producto: el storefront consulta productos publicados con las rutas nativas
 * de Medusa (`medusa_category_id` llega para ese filtro).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CATALOGUE_MODULE)
  const filters: Record<string, unknown> = { active: true }

  if (req.query.category_key !== undefined) {
    const parsed = catalogueCategoryKeySchema.safeParse(req.query.category_key)
    if (!parsed.success) return res.status(404).json({ message: "Categoría de catálogo no encontrada" })

    const [category] = await service.listCatalogueCategories({ key: parsed.data })
    if (!category) return res.status(404).json({ message: "Categoría de catálogo no encontrada" })
    const interaction = normalizeCatalogueInteraction(category)
    if (!interaction.active || interaction.interaction_locked) return res.json({ families: [] })
    if (!category.medusa_category_id) return res.json({ families: [] })
    filters.medusa_category_id = category.medusa_category_id
  }

  const families = (await service.listProductFamilies(filters, { order: { sort_order: "ASC", created_at: "ASC" } }))
    .sort(compareCatalogueOrder)

  res.json({
    families: families.map((family) => ({
      id: family.id,
      slug: family.slug,
      name: family.name,
      description: family.description,
      sort_order: family.sort_order,
      medusa_category_id: family.medusa_category_id,
    })),
  })
}
