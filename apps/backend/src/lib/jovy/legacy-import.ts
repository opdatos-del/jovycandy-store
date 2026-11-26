import type { LegacyProductPlan } from "./legacy-catalog"

type IdentityProduct = {
  id: string
  external_id?: string | null
  variants?: Array<{ id: string; sku?: string | null }> | null
}

/** Rechaza identidades de importación ambiguas antes de realizar escrituras. */
export function findLegacyIdentityConflict(
  plans: LegacyProductPlan[],
  products: IdentityProduct[],
): string | null {
  const manifestIds = new Set(plans.map((plan) => plan.externalId))
  const manifestSkus = new Set(plans.flatMap((plan) => plan.variants.map((variant) => variant.sku)))
  const ids = new Set<string>()
  const skus = new Set<string>()
  for (const product of products) {
    if (product.external_id && manifestIds.has(product.external_id)) {
      if (ids.has(product.external_id)) return `external_id duplicado: ${product.external_id}`
      ids.add(product.external_id)
    }
    for (const variant of product.variants ?? []) {
      if (!variant.sku || !manifestSkus.has(variant.sku)) continue
      if (skus.has(variant.sku)) return `SKU duplicado: ${variant.sku}`
      skus.add(variant.sku)
    }
  }
  return null
}

/** Metadata de procedencia para el producto creado por la migración. */
export function buildLegacyProductMetadata(
  plan: LegacyProductPlan,
  mediaRegistry: Record<string, string>,
  localRegistry: Record<string, string> = {},
): Record<string, unknown> {
  return {
    jovy_legacy_managed: true,
    jovy_legacy_external_id: plan.externalId,
    jovy_legacy_family_id: plan.familyId,
    jovy_legacy_source_updated_at: plan.sourceUpdatedAt,
    jovy_legacy_specs: plan.specs,
    jovy_synthetic_prices: true,
    jovy_media_registry: mediaRegistry,
    jovy_media_local_registry: localRegistry,
  }
}
