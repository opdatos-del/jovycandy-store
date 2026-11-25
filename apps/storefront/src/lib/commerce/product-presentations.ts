import { formatGrams, parseWeightGrams, weightLabel } from "@/lib/commerce/weight"
import type { CommerceProduct, CommerceVariant } from "@/lib/medusa/store"

export type ProductPresentation = {
  title: string
  label: string
  grams: number
}

export function isOfficialCatalogHandle(handle: string | null | undefined): boolean {
  return Boolean(handle?.startsWith("jovy-mx-"))
}

export const OFFICIAL_CATALOG_EXPECTED_PRODUCTS = 35

export function selectCatalogProducts<
  T extends {
    handle: string | null
    officialCatalogComplete?: boolean
    officialCatalogSize?: number | null
  },
>(products: T[]): Array<T & { handle: string }> {
  const viewable = products.filter(
    (product): product is T & { handle: string } => Boolean(product.handle),
  )
  const completeOfficial = viewable.filter(
    (product) =>
      product.officialCatalogComplete === true &&
      product.officialCatalogSize === OFFICIAL_CATALOG_EXPECTED_PRODUCTS,
  )
  if (completeOfficial.length === OFFICIAL_CATALOG_EXPECTED_PRODUCTS) {
    return completeOfficial
  }
  return viewable
}

export function variantGrams(variant: CommerceVariant): number | null {
  if (typeof variant.grams === "number" && variant.grams > 0) return variant.grams
  return parseWeightGrams(variant.title)
}

export function getProductPresentations(
  commerce: CommerceProduct | null,
): ProductPresentation[] {
  const presentations = new Map<number, ProductPresentation>()

  for (const variant of commerce?.variants ?? []) {
    const grams = variantGrams(variant)
    if (!grams) continue
    presentations.set(grams, {
      title: variant.title,
      label: weightLabel(variant.title) ?? formatGrams(grams) ?? variant.title,
      grams,
    })
  }

  return [...presentations.values()].sort((left, right) => left.grams - right.grams)
}

export function summarizePresentations(
  commerce: CommerceProduct | null,
  fallback: string | null,
): string | null {
  const presentations = getProductPresentations(commerce)
  if (!presentations.length) return fallback
  if (presentations.length === 1) return presentations[0].label
  return `${presentations[0].label} – ${presentations[presentations.length - 1].label}`
}

export function matchesPresentation(
  commerce: CommerceProduct | null,
  value: string,
): boolean {
  return getProductPresentations(commerce).some(
    (presentation) => presentation.label === value,
  )
}

export function lowestVariantPrice(
  commerce: CommerceProduct | null,
): { amount: number; currencyCode: string; count: number } | null {
  const priced = (commerce?.variants ?? []).filter(
    (variant): variant is CommerceVariant & { price: number } =>
      typeof variant.price === "number",
  )
  if (!priced.length) return null

  const cheapest = priced.reduce((current, variant) =>
    variant.price < current.price ? variant : current,
  )
  return {
    amount: cheapest.price,
    currencyCode: cheapest.currencyCode ?? "mxn",
    count: priced.length,
  }
}
