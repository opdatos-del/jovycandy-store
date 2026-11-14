import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  catalogueCategoryKeySchema,
  compareCatalogueOrder,
  familyInputSchema,
} from "@jovy/lib/jovy/catalogue"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { saveProductFamilyWorkflow } from "@jovy/workflows/jovy-catalogue/family"

type LinkedFamily = { id: string; products?: Array<{ id: string }> | null }

/**
 * Familias canónicas. `category_key` filtra por el `medusa_category_id` de la
 * tarjeta de presentación; sin esa vinculación la lista es vacía, no inventada.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CATALOGUE_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const categoryKey = req.query.category_key

  const filters: Record<string, unknown> = {}
  if (categoryKey !== undefined) {
    const parsed = catalogueCategoryKeySchema.safeParse(categoryKey)
    if (!parsed.success) return res.status(400).json({ message: "La categoría de catálogo no es válida" })

    const [category] = await service.listCatalogueCategories({ key: parsed.data })
    if (!category) return res.status(404).json({ message: "Categoría de catálogo no encontrada" })
    if (!category.medusa_category_id) return res.json({ families: [] })
    filters.medusa_category_id = category.medusa_category_id
  }

  const families = (await service.listProductFamilies(filters, { order: { sort_order: "ASC", created_at: "ASC" } }))
    .sort(compareCatalogueOrder)

  const { data } = families.length
    ? await query.graph({
        entity: "jovy_product_family",
        fields: ["id", "products.id"],
        filters: { id: families.map((family) => family.id) },
        pagination: { take: Math.max(families.length, 50), skip: 0 },
      })
    : { data: [] }
  const productIds = new Map(
    (data as unknown as LinkedFamily[]).map((family) => [family.id, (family.products ?? []).map((product) => product.id)]),
  )

  res.json({
    families: families.map((family) => ({
      ...family,
      product_ids: productIds.get(family.id) ?? [],
    })),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = familyInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "La familia no es válida", errors: parsed.error.flatten() })

  const { result: family } = await saveProductFamilyWorkflow(req.scope).run({ input: parsed.data })
  res.status(201).json({ family })
}
