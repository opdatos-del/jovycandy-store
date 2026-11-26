import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { catalogueCategoryKeySchema } from "@jovy/lib/jovy/catalogue"
import {
  compareProductEditorialOrder,
  findEditorialFamily,
  productPresentationCategoryKeys,
  resolveCommercialMode,
  resolveEditorialFamily,
  type EditorialProductRef,
} from "@jovy/lib/jovy/product-editorial"
import {
  decorateProductEditorial,
  EDITORIAL_PRODUCT_FIELDS,
  loadEditorialCatalogue,
  type DecoratedProductEditorial,
  type ProductEditorialRecord,
  type QueryGraph,
} from "@jovy/lib/jovy/product-editorial-graph"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"

type EditorialService = {
  listProductEditorials: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<ProductEditorialRecord[]>
}

type StoreRequest = MedusaRequest & {
  publishable_key_context?: { sales_channel_ids?: string[] }
}

type StoreProduct = EditorialProductRef & {
  created_at?: Date | string | null
}

/**
 * Lista los productos comerciales publicados del canal de la publishable key.
 * La capa editorial solo aporta presentación; no decide la pertenencia al
 * catálogo. Un producto publicado directamente en Medusa Admin aparece aunque
 * no tenga ficha editorial.
 */
async function listPublishedProducts(req: StoreRequest): Promise<StoreProduct[]> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const { data } = await query.graph({
    entity: "product",
    fields: [...EDITORIAL_PRODUCT_FIELDS],
    filters: { status: "published" },
    pagination: { take: 1_000, skip: 0 },
  })

  const salesChannelIds = req.publishable_key_context?.sales_channel_ids ?? []
  // Sin canal no hay catálogo público: nunca se devuelven productos de otro
  // canal por una publishable key mal configurada.
  if (!salesChannelIds.length) return []
  return (data as StoreProduct[]).filter((product) =>
    (product.sales_channels ?? []).some(
      (channel) => channel.id && salesChannelIds.includes(channel.id),
    ),
  )
}

/**
 * Ficha mínima para un producto que aún no tiene registro editorial. Se marca
 * como vendible porque el administrador ya lo publicó en Medusa; si no tiene
 * precio o variantes, el storefront muestra el estado comercial real.
 */
function synthesizeEditorial(
  product: StoreProduct,
  context: Parameters<typeof decorateProductEditorial>[1],
): DecoratedProductEditorial {
  const family = resolveEditorialFamily(product, context.families)
  return {
    id: `medusa:${product.id}`,
    product_id: product.id,
    gramaje: null,
    certifications: [],
    sort_order: 100_000,
    is_new: false,
    editorial_status: "published",
    commercial_mode: "sellable",
    published_at: product.created_at ?? null,
    product: {
      id: product.id,
      title: product.title ?? "",
      handle: product.handle ?? null,
      thumbnail: product.thumbnail ?? null,
    },
    product_missing: false,
    product_status: product.status ?? "published",
    family: family
      ? {
          id: family.id,
          slug: family.slug,
          name: family.name,
          card_preset: family.card_preset ?? null,
        }
      : null,
    category_keys: productPresentationCategoryKeys(product, context.categories),
    publish_issues: [],
    sellable_requirements: [],
  }
}

/**
 * Productos visibles en el storefront: publicados en Medusa y con ficha
 * editorial publicada cuando la ficha existe. Sin ficha, el producto comercial
 * es suficiente. Precios, variantes e inventario se siguen leyendo en
 * `/store/products` para no duplicar la fuente de verdad.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const catalogue = await loadEditorialCatalogue(req.scope)

  let categoryKey: string | null = null
  if (req.query.category_key !== undefined) {
    const parsed = catalogueCategoryKeySchema.safeParse(req.query.category_key)
    if (!parsed.success) {
      return res.status(404).json({ message: "Categoría de catálogo no encontrada" })
    }
    const category = catalogue.categories.find((candidate) => candidate.key === parsed.data)
    if (!category) {
      return res.status(404).json({ message: "Categoría de catálogo no encontrada" })
    }
    categoryKey = parsed.data
  }

  let familyId: string | null = null
  if (req.query.family_id !== undefined) {
    const family = findEditorialFamily(catalogue.families, String(req.query.family_id))
    if (!family) {
      return res.status(404).json({ message: "Familia de producto no encontrada" })
    }
    familyId = family.id
  }

  const service = req.scope.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService
  const [publishedProducts, records] = await Promise.all([
    listPublishedProducts(req as StoreRequest),
    service.listProductEditorials(
      {},
      { order: { sort_order: "ASC", created_at: "ASC" } },
    ),
  ])

  const productMap = new Map(publishedProducts.map((product) => [product.id, product]))
  const context = {
    products: productMap,
    categories: catalogue.categories,
    families: catalogue.families,
  }

  const decorated = records
    .map((record) => decorateProductEditorial(record, context))
    .filter(
      (record) =>
        record.product !== null &&
        record.product_status === "published" &&
        record.editorial_status === "published",
    )

  // Un producto con ficha existente pero no publicada queda oculto: la ficha
  // editorial expresa una decisión explícita. Solo los productos sin ficha se
  // sintetizan desde Medusa.
  const covered = new Set(records.map((record) => record.product_id))
  const synthesized = publishedProducts
    .filter((product) => !covered.has(product.id))
    .map((product) => synthesizeEditorial(product, context))

  const products = [...decorated, ...synthesized]
    .sort(compareProductEditorialOrder)
    .filter((item) => !categoryKey || item.category_keys.includes(categoryKey))
    .filter((item) => !familyId || item.family?.id === familyId)
    .map((item) => ({
      id: item.id,
      product: item.product,
      product_status: item.product_status,
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
