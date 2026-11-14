import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { catalogueCategoryKeySchema } from "@jovy/lib/jovy/catalogue"
import {
  compareProductEditorialOrder,
  editorialStatusSchema,
  findEditorialFamily,
  productEditorialProductIdSchema,
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
 * Listado editorial agregado. Los datos comerciales (id, título, handle,
 * thumbnail) se leen del Product Module en la misma petición; la ficha no los
 * copia. Un producto comercial eliminado se muestra como `product_missing`
 * para que el Admin pueda limpiar el registro editorial, y Store lo excluye.
 *
 * Filtros: `status` (enum), `category_key` (tarjeta de presentación mapeada),
 * `family_id` (id canónico o slug histórico) y `product_id` (resolución de una
 * sola ficha sin generar el 404 del detalle por producto).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const filters: Record<string, unknown> = {}

  if (req.query.status !== undefined) {
    const parsed = editorialStatusSchema.safeParse(req.query.status)
    if (!parsed.success) return res.status(400).json({ message: "El estado editorial no es válido" })
    filters.editorial_status = parsed.data
  }

  let categoryKey: string | null = null
  if (req.query.category_key !== undefined) {
    const parsed = catalogueCategoryKeySchema.safeParse(req.query.category_key)
    if (!parsed.success) return res.status(400).json({ message: "La categoría de catálogo no es válida" })
    categoryKey = parsed.data
  }

  let productId: string | null = null
  if (req.query.product_id !== undefined) {
    const parsed = productEditorialProductIdSchema.safeParse(req.query.product_id)
    if (!parsed.success) return res.status(400).json({ message: "El producto no es válido" })
    productId = parsed.data
    filters.product_id = productId
  }

  const service = req.scope.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService
  const catalogue = await loadEditorialCatalogue(req.scope)

  let familyId: string | null = null
  if (req.query.family_id !== undefined) {
    const family = findEditorialFamily(catalogue.families, String(req.query.family_id))
    if (!family) return res.status(404).json({ message: "Familia de producto no encontrada" })
    familyId = family.id
  }

  if (categoryKey) {
    const category = catalogue.categories.find((candidate) => candidate.key === categoryKey)
    if (!category) return res.status(404).json({ message: "Categoría de catálogo no encontrada" })
    // Una tarjeta sin categoría comercial no agrupa productos: no se inventa.
    if (!category.medusa_category_id) return res.json({ products: [] })
  }

  const records = (
    await service.listProductEditorials(filters, {
      order: { sort_order: "ASC", created_at: "ASC" },
      // La ficha borrada lógicamente solo se devuelve al resolver un producto
      // concreto: el Admin necesita `deleted` para ofrecer la restauración y el
      // listado general sigue excluyéndolas.
      ...(productId ? { withDeleted: true } : {}),
    })
  ).sort(compareProductEditorialOrder)

  const products = (await decorateEditorialRecords(req.scope, records, catalogue))
    .filter((item) => !categoryKey || item.category_keys.includes(categoryKey))
    .filter((item) => !familyId || item.family?.id === familyId)
    .map((item) => ({ ...item, deleted: Boolean(item.deleted_at) }))

  res.json({ products })
}
