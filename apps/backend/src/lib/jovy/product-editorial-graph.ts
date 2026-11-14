import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  productPresentationCategoryKeys,
  productPublishIssues,
  resolveEditorialFamily,
  type EditorialCatalogueCategory,
  type EditorialCatalogueFamily,
  type EditorialProductRef,
} from "@jovy/lib/jovy/product-editorial"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

/**
 * Lectura compartida de la capa editorial. El producto comercial y su familia
 * se resuelven en la misma consulta: el CMS no guarda copias de título ni de
 * imagen, solo `product_id`. Los handlers quedan delgados y Store/Admin ven la
 * misma proyección.
 */
type ReadScope = { resolve: (key: string) => unknown }

export type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number }
  }) => Promise<{ data: unknown[] }>
}

type CatalogueLookup = {
  listCatalogueCategories: (filters?: unknown, config?: unknown) => Promise<EditorialCatalogueCategory[]>
  listProductFamilies: (filters?: unknown, config?: unknown) => Promise<EditorialCatalogueFamily[]>
}

/** Campos mínimos del producto comercial; cualquier otro dato lo sirve Medusa. */
export const EDITORIAL_PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "thumbnail",
  "status",
  "categories.id",
  "jovy_product_family.id",
]

export type EditorialCatalogue = {
  categories: EditorialCatalogueCategory[]
  families: EditorialCatalogueFamily[]
}

export type ProductEditorialRecord = {
  id: string
  product_id: string
  gramaje: string | null
  certifications: string[] | null
  sort_order: number
  is_new: boolean
  editorial_status: string
  published_at?: Date | string | null
  created_at?: Date | string | null
  updated_at?: Date | string | null
  deleted_at?: Date | string | null
}

export type EditorialProductSummary = {
  id: string
  title: string
  handle: string | null
  thumbnail: string | null
}

export type DecoratedProductEditorial = ProductEditorialRecord & {
  product: EditorialProductSummary | null
  product_missing: boolean
  /** Estado del producto comercial; Store solo publica `published`. */
  product_status: string | null
  family: { id: string; slug: string; name: string } | null
  category_keys: string[]
  publish_issues: string[]
}

export async function loadEditorialCatalogue(scope: ReadScope): Promise<EditorialCatalogue> {
  const catalogue = scope.resolve(JOVY_CATALOGUE_MODULE) as CatalogueLookup
  const [categories, families] = await Promise.all([
    catalogue.listCatalogueCategories({}, { order: { sort_order: "ASC", created_at: "ASC" } }),
    catalogue.listProductFamilies({}, { order: { sort_order: "ASC", created_at: "ASC" } }),
  ])

  return {
    categories: categories.map((category) => ({
      key: category.key,
      medusa_category_id: category.medusa_category_id ?? null,
      active: category.active ?? null,
    })),
    families: families.map((family) => ({
      id: family.id,
      slug: family.slug,
      name: family.name,
      medusa_category_id: family.medusa_category_id ?? null,
      active: family.active ?? null,
    })),
  }
}

export async function fetchEditorialProducts(
  query: QueryGraph,
  productIds: readonly string[],
): Promise<Map<string, EditorialProductRef>> {
  const ids = [...new Set(productIds)]
  if (!ids.length) return new Map()

  const { data } = await query.graph({
    entity: "product",
    fields: EDITORIAL_PRODUCT_FIELDS,
    filters: { id: ids },
    pagination: { take: Math.max(ids.length, 50), skip: 0 },
  })

  return new Map((data as EditorialProductRef[]).map((product) => [product.id, product]))
}

/** Proyecta el registro editorial contra datos comerciales reales, sin copiarlos. */
export function decorateProductEditorial(
  record: ProductEditorialRecord,
  context: { products: Map<string, EditorialProductRef>; categories: EditorialCatalogueCategory[]; families: EditorialCatalogueFamily[] },
): DecoratedProductEditorial {
  const product = context.products.get(record.product_id) ?? null
  const family = resolveEditorialFamily(product, context.families)

  return {
    ...record,
    certifications: record.certifications ?? [],
    product: product
      ? {
          id: product.id,
          title: product.title ?? "",
          handle: product.handle ?? null,
          thumbnail: product.thumbnail ?? null,
        }
      : null,
    product_missing: !product,
    product_status: product?.status ?? null,
    family: family ? { id: family.id, slug: family.slug, name: family.name } : null,
    category_keys: productPresentationCategoryKeys(product, context.categories),
    publish_issues: productPublishIssues(product, context.categories, context.families),
  }
}

/**
 * Carga las dependencias una vez para uno o varios registros. Evita que cada
 * handler repita el mismo par de consultas (producto comercial + taxonomía).
 * El listado puede pasar la taxonomía que ya resolvió para sus filtros.
 */
export async function decorateEditorialRecords(
  scope: ReadScope,
  records: readonly ProductEditorialRecord[],
  preloaded?: EditorialCatalogue,
): Promise<DecoratedProductEditorial[]> {
  if (!records.length) return []

  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const [products, catalogue] = await Promise.all([
    fetchEditorialProducts(
      query,
      records.map((record) => record.product_id),
    ),
    preloaded ?? loadEditorialCatalogue(scope),
  ])

  return records.map((record) =>
    decorateProductEditorial(record, {
      products,
      categories: catalogue.categories,
      families: catalogue.families,
    }),
  )
}
