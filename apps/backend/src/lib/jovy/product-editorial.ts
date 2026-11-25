import { z } from "@medusajs/framework/zod"
import { compareCatalogueOrder } from "@jovy/lib/jovy/catalogue"

/**
 * Capa editorial de producto. Vive aparte del producto comercial de Medusa:
 * aquí solo hay atributos que el CMS histórico guardaba y que el Product Module
 * no cubre (gramaje, certificaciones, orden dentro del catálogo, novedad y
 * estado de publicación). Nunca se copian SKU, precio, stock, variantes ni
 * imágenes comerciales: `product_id` es la única referencia.
 */
export const GRAMAJE_MAX_LENGTH = 50

export const PRODUCT_EDITORIAL_STATUSES = ["draft", "published", "archived"] as const
export type ProductEditorialStatus = (typeof PRODUCT_EDITORIAL_STATUSES)[number]

/**
 * Modalidad comercial de la ficha. `catalog_only` muestra el producto en el
 * catálogo sin permitir la compra; `sellable` autoriza la venta solo después de
 * la validación del servidor. `null` marca fichas históricas sin clasificar y
 * siempre se resuelve como CATALOG_ONLY: nunca se auto-clasifica como vendible.
 */
export const COMMERCIAL_MODES = ["catalog_only", "sellable"] as const
export type CommercialMode = (typeof COMMERCIAL_MODES)[number]

export const RESOLVED_COMMERCIAL_MODES = ["CATALOG_ONLY", "SELLABLE"] as const
export type ResolvedCommercialMode = (typeof RESOLVED_COMMERCIAL_MODES)[number]

/** Códigos informativos de requisitos pendientes para poder vender. */
export const SELLABLE_REQUIREMENT_CODES = ["variants", "prices", "sales_channel", "inventory_policy"] as const
export type SellableRequirementCode = (typeof SELLABLE_REQUIREMENT_CODES)[number]

/** Toda modalidad no explícitamente `sellable` se resuelve como catálogo. */
export function resolveCommercialMode(mode: CommercialMode | null | undefined): ResolvedCommercialMode {
  return mode === "sellable" ? "SELLABLE" : "CATALOG_ONLY"
}

/**
 * Catálogo permitido de certificaciones (valores que mostraba el histórico).
 * Es un enum cerrado a propósito: una certificación nueva se agrega aquí y en
 * la migración de datos correspondiente, no se acepta texto libre.
 */
export const PRODUCT_CERTIFICATIONS = ["SGS", "OU Kosher", "Halal"] as const
export type ProductCertification = (typeof PRODUCT_CERTIFICATIONS)[number]

export const editorialStatusSchema = z.enum(PRODUCT_EDITORIAL_STATUSES)
export const certificationSchema = z.enum(PRODUCT_CERTIFICATIONS)

/**
 * Referencia al producto comercial en consultas (`?product_id=`). Se valida
 * como texto acotado: el listado no interpreta el id, solo filtra por él.
 */
export const productEditorialProductIdSchema = z.string().trim().min(1).max(255)

const editorialFields = {
  gramaje: z
    .string()
    .trim()
    .max(GRAMAJE_MAX_LENGTH, `El gramaje no debe superar los ${GRAMAJE_MAX_LENGTH} caracteres`)
    .nullable()
    .optional(),
  certifications: z
    .array(certificationSchema)
    .max(PRODUCT_CERTIFICATIONS.length)
    .refine((values) => new Set(values).size === values.length, "Las certificaciones no deben repetirse")
    .optional(),
  sort_order: z.number().int().min(0).optional(),
  is_new: z.boolean().optional(),
  editorial_status: editorialStatusSchema.optional(),
  commercial_mode: z.enum(COMMERCIAL_MODES).nullable().optional(),
}

/**
 * `PUT` es un upsert parcial: cada campo enviado se valida aquí y lo omitido
 * conserva el valor almacenado. `product_id` viaja en la ruta, no en el cuerpo;
 * `.strict()` rechaza claves desconocidas en lugar de ignorarlas.
 */
export const productEditorialInputSchema = z.object(editorialFields).strict()

export type ProductEditorialInput = z.infer<typeof productEditorialInputSchema>

/** Producto comercial mínimo que la capa editorial necesita leer de Medusa. */
export type EditorialProductRef = {
  id: string
  title?: string | null
  handle?: string | null
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
  /** Estado comercial de Medusa (`draft`, `published`, ...). */
  status?: string | null
  categories?: Array<{ id: string }> | null
  jovy_product_family?: { id?: string | null } | null
  /** Campos comerciales que el graph ya consulta para el diagnóstico de venta. */
  variants?: SellableProductSnapshot["variants"]
  sales_channels?: SellableProductSnapshot["sales_channels"]
}

/**
 * Instantánea mínima del producto comercial tal como la devuelve el graph.
 * Todos los campos son opcionales: la capa editorial no exige datos comerciales
 * para mostrar el catálogo y esta función solo informa de lo que falta.
 */
export type SellableProductSnapshot = {
  variants?: ReadonlyArray<{
    id?: string | null
    prices?: ReadonlyArray<{ id?: string | null; amount?: number | null }> | null
    inventory_items?: ReadonlyArray<{ inventory_item_id?: string | null }> | null
    allow_backorder?: boolean | null
  }> | null
  sales_channels?: ReadonlyArray<{ id?: string | null }> | null
}

export type EditorialCatalogueCategory = {
  key: string
  medusa_category_id?: string | null
  active?: boolean | null
}

export type EditorialCatalogueFamily = {
  id: string
  slug: string
  name: string
  medusa_category_id?: string | null
  card_preset?: string | null
  active?: boolean | null
}

/**
 * Familia efectiva del producto. Primero manda el Module Link real
 * (`jovy_product_family.product`); si aún no existe, se usa la primera
 * categoría comercial del producto que esté mapeada a una familia. Es la misma
 * derivación que `sync-jovy-catalogue`, así que la ficha editorial funciona
 * antes y después de ejecutar la sincronización, sin inventar familias.
 */
export function resolveEditorialFamily(
  product: EditorialProductRef | null | undefined,
  families: readonly EditorialCatalogueFamily[],
): EditorialCatalogueFamily | null {
  if (!product) return null

  const linkedId = product.jovy_product_family?.id
  if (linkedId) {
    const linked = families.find((family) => family.id === linkedId)
    if (linked) return linked
  }

  for (const category of product.categories ?? []) {
    const family = families.find(
      (candidate) => candidate.medusa_category_id && candidate.medusa_category_id === category.id,
    )
    if (family) return family
  }

  return null
}

/** Claves de presentación del producto derivadas de sus categorías comerciales. */
export function productPresentationCategoryKeys(
  product: EditorialProductRef | null | undefined,
  categories: readonly EditorialCatalogueCategory[],
): string[] {
  if (!product) return []
  const productCategoryIds = new Set((product.categories ?? []).map((category) => category.id))
  return categories
    .filter((category) => category.medusa_category_id && productCategoryIds.has(category.medusa_category_id))
    .map((category) => category.key)
}

/** Acepta el id canónico de `jovy_product_family` o su slug histórico. */
export function findEditorialFamily(
  families: readonly EditorialCatalogueFamily[],
  reference: string,
): EditorialCatalogueFamily | null {
  const value = reference.trim()
  if (!value) return null
  return families.find((family) => family.id === value) ?? families.find((family) => family.slug === value) ?? null
}

/**
 * Regla histórica de publicación: categoría de presentación válida, familia no
 * vacía, nombre e imagen principal. El gramaje NO era requisito y se sigue sin
 * exigir. Los valores devueltos son nombres de campo, nunca datos del producto,
 * y se listan en el orden de la regla original.
 *
 * "Categoría válida" significa una tarjeta de catálogo mapeada a una categoría
 * comercial del producto; no exige que la tarjeta esté publicada. Ocultar una
 * tarjeta (`active = false`) cambia su visibilidad en Store, no el estado
 * editorial de sus productos.
 */
export function productPublishIssues(
  product: EditorialProductRef | null | undefined,
  categories: readonly EditorialCatalogueCategory[],
  families: readonly EditorialCatalogueFamily[],
): string[] {
  if (!product) return ["producto comercial"]

  const issues: string[] = []
  if (productPresentationCategoryKeys(product, categories).length === 0) issues.push("categoría de presentación")
  if (!resolveEditorialFamily(product, families)) issues.push("familia")
  if (!product.title?.trim()) issues.push("nombre")
  if (!product.thumbnail) issues.push("imagen principal")
  return issues
}

/**
 * Requisitos pendientes para que un producto pueda venderse, derivados de los
 * campos comerciales que ya lee el graph. Es puramente informativo: NO habilita
 * la venta por sí solo. La autorización depende de `commercial_mode` y de la
 * validación del servidor en los hooks del carrito. El orden de salida es fijo.
 */
export function sellableRequirements(
  product: SellableProductSnapshot | null | undefined,
): SellableRequirementCode[] {
  const pending = new Set<SellableRequirementCode>()
  const variants = product?.variants ?? []

  if (variants.length === 0) {
    pending.add("variants")
    pending.add("prices")
    pending.add("inventory_policy")
  } else {
    if (!variants.some((variant) => (variant.prices?.length ?? 0) > 0)) pending.add("prices")
    const hasInventoryPolicy = variants.some(
      (variant) =>
        (variant.inventory_items?.length ?? 0) > 0 ||
        variant.allow_backorder === true,
    )
    if (!hasInventoryPolicy) pending.add("inventory_policy")
  }

  if (!(product?.sales_channels?.length ?? 0)) pending.add("sales_channel")

  return SELLABLE_REQUIREMENT_CODES.filter((code) => pending.has(code))
}

/** Solo lo publicado llega a Store; `archived` y `draft` se ocultan. */
export function isEditorialProductPublic(record: { editorial_status: string }) {
  return record.editorial_status === "published"
}

/**
 * `published_at` es la fecha de la transición a publicado, no la de cada
 * guardado. Mientras la ficha siga en `published` se conserva la original; una
 * ficha antigua publicada sin fecha recibe una al guardarse.
 */
export function resolveEditorialPublishedAt(
  existing: { editorial_status?: string | null; published_at?: Date | string | null } | null | undefined,
  nextStatus: string,
  now = new Date(),
): Date | null {
  if (nextStatus !== "published") return null

  if (existing?.editorial_status === "published" && existing.published_at) {
    const original = new Date(existing.published_at)
    if (!Number.isNaN(original.getTime())) return original
  }

  return now
}

/**
 * Mismo desempate determinista que el catálogo de presentación
 * (`sort_order` → `created_at` → `id`); se expone con nombre propio para que la
 * capa editorial no dependa del nombre de una función de otra pantalla.
 */
export function compareProductEditorialOrder(
  a: { sort_order: number; created_at?: Date | string | null; id?: string },
  b: { sort_order: number; created_at?: Date | string | null; id?: string },
) {
  return compareCatalogueOrder(a, b)
}
