import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { catalogueCategoryKeySchema } from "@jovy/lib/jovy/catalogue"
import {
  compareProductEditorialOrder,
  findEditorialFamily,
  resolveCommercialMode,
} from "@jovy/lib/jovy/product-editorial"
import {
  decorateEditorialRecords,
  loadEditorialCatalogue,
  type ProductEditorialRecord,
} from "@jovy/lib/jovy/product-editorial-graph"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"

type EditorialService = {
  listProductEditorials: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<ProductEditorialRecord[]>
}

/**
 * Productos editoriales publicados. Devuelve los atributos del CMS y una
 * referencia mínima al producto comercial (`id`, `title`, `handle`, `thumbnail`);
 * precios, variantes e inventario se siguen leyendo en `/store/products` para no
 * duplicar la fuente de verdad.
 *
 * Se excluyen las fichas cuyo producto comercial ya no existe o cuyo producto
 * de Medusa no está `published`: la ficha editorial es la capa de presentación,
 * no sustituye la publicación comercial. `product_status` se expone para que el
 * consumidor pueda distinguir la causa sin abrir `/store/products`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catalogue = await loadEditorialCatalogue(req.scope)

  let categoryKey: string | null = null
  if (req.query.category_key !== undefined) {
    const parsed = catalogueCategoryKeySchema.safeParse(req.query.category_key)
    if (!parsed.success) return res.status(404).json({ message: "Categoría de catálogo no encontrada" })

    const category = catalogue.categories.find((candidate) => candidate.key === parsed.data)
    if (!category) return res.status(404).json({ message: "Categoría de catálogo no encontrada" })
    if (!category.medusa_category_id) return res.json({ products: [] })
    categoryKey = parsed.data
  }

  let familyId: string | null = null
  if (req.query.family_id !== undefined) {
    const family = findEditorialFamily(catalogue.families, String(req.query.family_id))
    if (!family) return res.status(404).json({ message: "Familia de producto no encontrada" })
    familyId = family.id
  }

  const service = req.scope.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService
  const records = (
    await service.listProductEditorials(
      { editorial_status: "published" },
      { order: { sort_order: "ASC", created_at: "ASC" } },
    )
  ).sort(compareProductEditorialOrder)

  const products = (await decorateEditorialRecords(req.scope, records))
    .filter((item) => item.product !== null && item.product_status === "published")
    .filter((item) => !categoryKey || item.category_keys.includes(categoryKey))
    .filter((item) => !familyId || item.family?.id === familyId)
    .map((item) => ({
      id: item.id,
      product: item.product,
      product_status: item.product_status,
      // Modalidad derivada: nunca se exponen precios ni inventario desde aquí.
      commercial_mode: resolveCommercialMode(item.commercial_mode),
      gramaje: item.gramaje,
      certifications: item.certifications,
      is_new: item.is_new,
      sort_order: item.sort_order,
      published_at: item.published_at ?? null,
      family: item.family,
      category_keys: item.category_keys,
    }))

  res.json({ products })
}
