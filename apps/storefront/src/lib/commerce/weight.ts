/**
 * Presentaciones en gramos para el storefront.
 *
 * Medusa es la fuente de verdad de las variantes; estas utilidades solo
 * interpretan su etiqueta para ordenar, mostrar y comparar precios por gramo.
 */

const OUNCE_GRAMS = 28.3495
const POUND_GRAMS = 453.592

export function parseWeightGrams(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.trim().toLowerCase().match(/^([\d.,]+)\s*(oz|g|kg|lb)$/)
  if (!match) return null

  const amount = Number(match[1].replace(",", "."))
  if (!Number.isFinite(amount) || amount <= 0) return null

  switch (match[2]) {
    case "oz":
      return Math.round(amount * OUNCE_GRAMS)
    case "kg":
      return Math.round(amount * 1000)
    case "lb":
      return Math.round(amount * POUND_GRAMS)
    default:
      return Math.round(amount)
  }
}

export function formatGrams(grams: number | null | undefined): string | null {
  if (typeof grams !== "number" || !Number.isFinite(grams) || grams <= 0) return null
  if (grams >= 1000) {
    const kilos = grams / 1000
    return `${Number.isInteger(kilos) ? kilos : kilos.toFixed(1)} kg`
  }
  return `${Math.round(grams)} g`
}

/** Etiqueta con gramo como unidad principal; conserva la original si no se puede interpretar. */
export function weightLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return formatGrams(parseWeightGrams(value)) ?? value
}

export function gramsFromLabel(label: string | null | undefined): number {
  return parseWeightGrams(label) ?? Number.MAX_SAFE_INTEGER
}

export function sortByWeight<T extends { title: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => gramsFromLabel(left.title) - gramsFromLabel(right.title))
}
