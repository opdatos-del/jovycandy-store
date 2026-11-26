import { createHash } from "node:crypto"

import type { OfficialCatalogManifest, OfficialProductPlan } from "./official-catalog"

export type OfficialCatalogPersistedProduct = {
  id: string
  external_id?: string | null
  handle?: string | null
  metadata?: Record<string, unknown> | null
  variants?: Array<{
    sku?: string | null
    manage_inventory?: boolean
    allow_backorder?: boolean
    metadata?: Record<string, unknown> | null
    prices?: Array<{ currency_code?: string | null }> | null
    inventory_items?: Array<{ inventory_item_id?: string | null }> | null
  }> | null
}

export type OfficialCatalogIntegrity = {
  issues: string[]
  hash: string
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  )
}

export function hashOfficialCatalogValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex")
}

/** Huella estable del manifiesto que se espera persistir, no de su orden JSON. */
export function officialCatalogManifestFingerprint(
  catalog: OfficialCatalogManifest,
): string {
  return hashOfficialCatalogValue(catalog)
}

/**
 * Revisa sólo invariantes gestionadas por la importación. No incorpora título,
 * descripciones ni precios existentes para no invalidar ediciones del Admin.
 */
export function inspectOfficialCatalogIntegrity(
  plans: OfficialProductPlan[],
  products: OfficialCatalogPersistedProduct[],
): OfficialCatalogIntegrity {
  const officialIds = new Set(plans.map((plan) => plan.externalId))
  const officialProducts = products.filter((product) =>
    officialIds.has(String(product.external_id ?? "")),
  )
  const byExternalId = new Map(
    officialProducts.map((product) => [String(product.external_id), product]),
  )
  const issues: string[] = []

  if (officialProducts.length !== plans.length) {
    issues.push(
      `Se esperaban ${plans.length} productos oficiales y se encontraron ${officialProducts.length}`,
    )
  }

  const records = plans
    .map((plan) => {
      const product = byExternalId.get(plan.externalId)
      if (!product) {
        issues.push(`Falta el producto oficial ${plan.externalId}`)
        return { externalId: plan.externalId, missing: true }
      }
      if (product.metadata?.jovy_official_managed !== true) {
        issues.push(`El producto ${plan.externalId} no está marcado como gestionado`)
      }

      const variants = new Map(
        (product.variants ?? [])
          .filter((variant) => variant.sku)
          .map((variant) => [String(variant.sku), variant]),
      )
      return {
        externalId: plan.externalId,
        managed: product.metadata?.jovy_official_managed === true,
        variants: plan.variants.map((planVariant) => {
          const variant = variants.get(planVariant.sku)
          if (!variant) {
            issues.push(`Falta la variante oficial ${planVariant.sku}`)
            return { sku: planVariant.sku, missing: true }
          }
          const hasMxn = (variant.prices ?? []).some(
            (price) => price.currency_code?.toLowerCase() === "mxn",
          )
          const inventoryLinked = (variant.inventory_items ?? []).some(
            (item) => Boolean(item.inventory_item_id),
          )
          const managed =
            variant.manage_inventory === true &&
            variant.allow_backorder === false &&
            Number(variant.metadata?.jovy_official_grams) === planVariant.grams
          if (!hasMxn) issues.push(`La variante ${planVariant.sku} no tiene precio MXN`)
          if (!inventoryLinked) {
            issues.push(`La variante ${planVariant.sku} no tiene inventory item`)
          }
          if (!managed) {
            issues.push(`La variante ${planVariant.sku} no conserva su configuración oficial`)
          }
          return {
            sku: planVariant.sku,
            hasMxn,
            inventoryLinked,
            managed,
          }
        }),
      }
    })
    .sort((left, right) => left.externalId.localeCompare(right.externalId))

  return { issues, hash: hashOfficialCatalogValue(records) }
}

export function isOfficialCatalogCompletionCurrent(
  plans: OfficialProductPlan[],
  products: OfficialCatalogPersistedProduct[],
  manifestSha256: string,
): boolean {
  const integrity = inspectOfficialCatalogIntegrity(plans, products)
  return (
    integrity.issues.length === 0 &&
    plans.every((plan) => {
      const product = products.find(
        (candidate) => candidate.external_id === plan.externalId,
      )
      return (
        product?.metadata?.jovy_official_catalog_complete === true &&
        product.metadata?.jovy_official_catalog_manifest_sha256 === manifestSha256 &&
        product.metadata?.jovy_official_catalog_integrity_sha256 === integrity.hash
      )
    })
  )
}
