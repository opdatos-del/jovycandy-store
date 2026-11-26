import type { OfficialProductPlan } from "./official-catalog"

export const RINGS_VISUAL_SOURCE_HANDLE = "jovy-aros-manzana-verde"

const RINGS_VISUAL_KEYS = [
  "card_hover_enabled",
  "card_hover_mode",
  "card_hover_preset",
  "card_hover_swap_url",
  "card_hover_overlay_url",
  "card_hover_full_url",
  "card_hover_base_url",
  "card_hover_background",
  "card_hover_duration_ms",
  "card_hover_intensity",
  "card_gummy_url",
  "card_visual_version",
] as const

type IdentityProduct = {
  id: string
  external_id?: string | null
  variants?: Array<{ id: string; sku?: string | null }> | null
}

/** Rechaza identidades oficiales ambiguas antes de realizar escrituras. */
export function findOfficialIdentityConflict(
  plans: OfficialProductPlan[],
  products: IdentityProduct[],
): string | null {
  const officialIds = new Set(plans.map((plan) => plan.externalId))
  const officialSkus = new Set(plans.flatMap((plan) => plan.variants.map((variant) => variant.sku)))
  const ids = new Set<string>()
  const skus = new Set<string>()
  for (const product of products) {
    if (product.external_id && officialIds.has(product.external_id)) {
      if (ids.has(product.external_id)) return `external_id duplicado: ${product.external_id}`
      ids.add(product.external_id)
    }
    for (const variant of product.variants ?? []) {
      if (!variant.sku || !officialSkus.has(variant.sku)) continue
      if (skus.has(variant.sku)) return `SKU duplicado: ${variant.sku}`
      skus.add(variant.sku)
    }
  }
  return null
}

type MetadataSource = {
  handle?: string | null
  metadata?: Record<string, unknown> | null
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

/**
 * Copia una sola vez la configuración visual histórica de Rings Manzana Verde.
 * No se propaga a otros sabores ni se reemplaza una edición manual posterior.
 */
export function inheritRingsVisualMetadata(
  plan: OfficialProductPlan,
  products: MetadataSource[],
): Record<string, unknown> {
  if (
    plan.familyId !== "rings" ||
    normalizeTitle(plan.title) !== "rings manzana"
  ) {
    return {}
  }

  const source = products.find(
    (product) => product.handle === RINGS_VISUAL_SOURCE_HANDLE,
  )
  if (!source?.metadata) return {}

  const metadata: Record<string, unknown> = {}
  for (const key of RINGS_VISUAL_KEYS) {
    const value = source.metadata[key]
    if (value !== undefined && value !== null) metadata[key] = value
  }
  return metadata
}

/** Fusiona metadata oficial sin perder ajustes manuales ni medios registrados. */
export function mergeOfficialProductMetadata(
  plan: OfficialProductPlan,
  mediaRegistry: Record<string, string>,
  existing?: Record<string, unknown> | null,
  inherited: Record<string, unknown> = {},
  localRegistry: Record<string, string> = {},
): Record<string, unknown> {
  const previousRegistry =
    existing?.jovy_media_registry &&
    typeof existing.jovy_media_registry === "object" &&
    !Array.isArray(existing.jovy_media_registry)
      ? (existing.jovy_media_registry as Record<string, unknown>)
      : {}

  const inheritedMissing = existing
    ? Object.fromEntries(
        Object.entries(inherited).filter(
          ([key]) => existing[key] === undefined,
        ),
      )
    : inherited

  return {
    ...inheritedMissing,
    ...(existing ?? {}),
    jovy_official_managed: true,
    jovy_official_external_id: plan.externalId,
    jovy_official_family_id: plan.familyId,
    ...(!existing
      ? {
          jovy_official_updated_at: plan.sourceUpdatedAt,
          jovy_official_specs: plan.specs,
        }
      : {}),
    jovy_synthetic_prices: true,
    jovy_media_registry: {
      ...previousRegistry,
      ...mediaRegistry,
    },
    jovy_media_local_registry: {
      ...(existing?.jovy_media_local_registry &&
      typeof existing.jovy_media_local_registry === "object" &&
      !Array.isArray(existing.jovy_media_local_registry)
        ? existing.jovy_media_local_registry
        : {}),
      ...localRegistry,
    },
  }
}
