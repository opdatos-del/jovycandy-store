import { JOVY_SEED_CATEGORIES } from "./catalog-seed"
import type { OfficialProductPlan } from "./official-catalog"

export const OFFICIAL_CATALOG_APPROVABLE_FIELDS = [
  "title",
  "description",
  "weight",
] as const

export type OfficialCatalogApprovableField =
  (typeof OFFICIAL_CATALOG_APPROVABLE_FIELDS)[number]

export type OfficialCatalogPreviewProduct = {
  id: string
  external_id?: string | null
  title?: string | null
  description?: string | null
  weight?: number | null
  status?: string | null
  metadata?: Record<string, unknown> | null
  categories?: Array<{ handle?: string | null }> | null
  variants?: Array<{
    sku?: string | null
    title?: string | null
    metadata?: Record<string, unknown> | null
    prices?: Array<{ currency_code?: string | null; amount?: number | null }> | null
  }> | null
}

export type OfficialCatalogPreviewChange = {
  field: OfficialCatalogApprovableField
  current: string | number | null
  official: string | number | null
}

export type OfficialCatalogVariantDifference = {
  sku: string
  state: "missing" | "different" | "equal"
  currentTitle: string | null
  officialTitle: string
  currentGrams: number | null
  officialGrams: number
  hasMxnPrice: boolean
}

export type OfficialCatalogDiagnosticField =
  | "status"
  | "category"
  | "family"
  | "specs"
  | "source_updated_at"

/** Diferencias visibles que sólo puede reconciliar el seed controlado. */
export type OfficialCatalogDiagnostic = {
  field: OfficialCatalogDiagnosticField
  current: string
  official: string
}

export type OfficialCatalogPreviewEntry = {
  externalId: string
  productId: string | null
  handle: string
  state: "missing" | "different" | "equal"
  changes: OfficialCatalogPreviewChange[]
  diagnostics: OfficialCatalogDiagnostic[]
  variants: OfficialCatalogVariantDifference[]
}

type FieldSource = Pick<
  OfficialCatalogPreviewProduct,
  "title" | "description" | "weight"
>

function text(value: unknown, fallback = "Sin valor"): string {
  if (value === null || value === undefined || value === "") return fallback
  if (typeof value === "string") return value
  return JSON.stringify(value)
}

function productDiagnostics(
  product: OfficialCatalogPreviewProduct,
  plan: OfficialProductPlan,
): OfficialCatalogDiagnostic[] {
  const currentCategory = (product.categories ?? [])
    .map((category) => category.handle)
    .filter((handle): handle is string => Boolean(handle))
    .sort()
    .join(", ")
  const officialCategory =
    JOVY_SEED_CATEGORIES.find((category) => category.key === plan.categoryKey)
      ?.handle ?? plan.categoryKey
  const comparisons: Array<[OfficialCatalogDiagnosticField, string, string]> = [
    ["status", text(product.status), "published"],
    ["category", text(currentCategory, "Sin categoría"), officialCategory],
    [
      "family",
      text(product.metadata?.jovy_official_family_id),
      plan.familyId,
    ],
    [
      "specs",
      text(product.metadata?.jovy_official_specs, "[]"),
      JSON.stringify(plan.specs),
    ],
    [
      "source_updated_at",
      text(product.metadata?.jovy_official_updated_at),
      text(plan.sourceUpdatedAt),
    ],
  ]
  return comparisons
    .filter(([, current, official]) => current !== official)
    .map(([field, current, official]) => ({ field, current, official }))
}

function productChanges(
  product: FieldSource,
  plan: OfficialProductPlan,
): OfficialCatalogPreviewChange[] {
  const expected = {
    title: plan.title,
    description: plan.description,
    weight: plan.variants[0]?.grams ?? null,
  } satisfies Record<OfficialCatalogApprovableField, string | number | null>

  return OFFICIAL_CATALOG_APPROVABLE_FIELDS.flatMap((field) => {
    const current = product[field] ?? null
    const official = expected[field]
    return current === official ? [] : [{ field, current, official }]
  })
}

/**
 * Contrasta campos comerciales contra la fuente sin escribir. Variantes,
 * precios e inventario se exponen como diagnóstico: nunca se aprueban desde
 * aquí porque el seed conserva sus garantías específicas.
 */
export function buildOfficialCatalogPreview(
  plans: OfficialProductPlan[],
  products: OfficialCatalogPreviewProduct[],
): OfficialCatalogPreviewEntry[] {
  const byExternalId = new Map(
    products
      .filter((product) => product.external_id)
      .map((product) => [String(product.external_id), product]),
  )

  return plans.map((plan) => {
    const product = byExternalId.get(plan.externalId)
    if (!product) {
      return {
        externalId: plan.externalId,
        productId: null,
        handle: plan.handle,
        state: "missing",
        changes: [],
        diagnostics: [],
        variants: plan.variants.map((variant) => ({
          sku: variant.sku,
          state: "missing",
          currentTitle: null,
          officialTitle: variant.title,
          currentGrams: null,
          officialGrams: variant.grams,
          hasMxnPrice: false,
        })),
      }
    }

    const variantsBySku = new Map(
      (product.variants ?? [])
        .filter((variant) => variant.sku)
        .map((variant) => [String(variant.sku), variant]),
    )
    const variants = plan.variants.map((variant) => {
      const current = variantsBySku.get(variant.sku)
      if (!current) {
        return {
          sku: variant.sku,
          state: "missing" as const,
          currentTitle: null,
          officialTitle: variant.title,
          currentGrams: null,
          officialGrams: variant.grams,
          hasMxnPrice: false,
        }
      }
      const currentGrams = Number(current.metadata?.jovy_official_grams)
      const hasMxnPrice = (current.prices ?? []).some(
        (price) => price.currency_code?.toLowerCase() === "mxn",
      )
      const equal =
        current.title === variant.title &&
        currentGrams === variant.grams &&
        hasMxnPrice
      return {
        sku: variant.sku,
        state: equal ? ("equal" as const) : ("different" as const),
        currentTitle: current.title ?? null,
        officialTitle: variant.title,
        currentGrams: Number.isFinite(currentGrams) ? currentGrams : null,
        officialGrams: variant.grams,
        hasMxnPrice,
      }
    })
    const changes = productChanges(product, plan)
    const diagnostics = productDiagnostics(product, plan)
    return {
      externalId: plan.externalId,
      productId: product.id,
      handle: plan.handle,
      state:
        changes.length ||
        diagnostics.length ||
        variants.some((variant) => variant.state !== "equal")
          ? ("different" as const)
          : ("equal" as const),
      changes,
      diagnostics,
      variants,
    }
  })
}

export function officialCatalogPatchForFields(
  plan: OfficialProductPlan,
  fields: OfficialCatalogApprovableField[],
): Record<OfficialCatalogApprovableField, string | number | null> {
  const source = {
    title: plan.title,
    description: plan.description,
    weight: plan.variants[0]?.grams ?? null,
  } satisfies Record<OfficialCatalogApprovableField, string | number | null>
  return Object.fromEntries(fields.map((field) => [field, source[field]])) as Record<
    OfficialCatalogApprovableField,
    string | number | null
  >
}
