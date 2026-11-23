/**
 * Presentaciones comerciales del catálogo de laboratorio.
 *
 * El gramaje editorial sirve como referencia descriptiva, pero la compra se
 * resuelve con variantes reales de Medusa. Estas funciones derivan una escalera
 * corta de presentaciones en gramos a partir del paquete base y calculan un
 * precio proporcional de laboratorio. No son reglas de negocio productivas:
 * precio y presentaciones definitivas se administran desde Medusa Admin.
 */

export type JovyPresentation = {
  grams: number
  label: string
  priceMxn: number
}

const OUNCE_GRAMS = 28.3495
const POUND_GRAMS = 453.592
const STANDARD_SIZES = [100, 250, 500, 1000] as const

/** Convierte "6 oz", "141 g", "5.29 oz" o "1 kg" a gramos enteros. */
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

/** Etiqueta legible con el gramo como unidad principal. */
export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return ""
  if (grams >= 1000) {
    const kilos = grams / 1000
    return `${Number.isInteger(kilos) ? kilos : kilos.toFixed(1)} kg`
  }
  return `${Math.round(grams)} g`
}

/**
 * Escalera corta de presentaciones: conserva el paquete base y agrega hasta dos
 * tamaños estándar mayores para no inflar el selector.
 */
export function presentationLadder(baseGrams: number): number[] {
  if (!Number.isFinite(baseGrams) || baseGrams <= 0) return []

  let sizes: number[]
  if (baseGrams >= 900) sizes = [250, 500, 1000]
  else if (baseGrams >= 450) sizes = [baseGrams, 1000]
  else if (baseGrams >= 200) sizes = [baseGrams, 500, 1000]
  else sizes = [baseGrams, 250, 500]

  return [...new Set(sizes.filter((size) => size > 0))].sort((a, b) => a - b)
}

/**
 * Precio de laboratorio proporcional al gramo, con descuento suave por volumen.
 * El paquete base conserva exactamente el precio de seed.
 */
export function presentationPriceMxn(
  basePriceMxn: number,
  baseGrams: number,
  grams: number,
): number {
  if (grams === baseGrams) return basePriceMxn
  if (baseGrams <= 0) return basePriceMxn

  const discount = grams >= 1000 ? 0.85 : grams >= 500 ? 0.92 : 1
  const raw = (basePriceMxn / baseGrams) * grams * discount
  return Math.max(10, Math.round(raw / 5) * 5)
}

export function buildPresentations(
  gramaje: string | null | undefined,
  priceMxn: number,
): JovyPresentation[] {
  const baseGrams = parseWeightGrams(gramaje)
  if (!baseGrams) return []
  return presentationLadder(baseGrams).map((grams) => ({
    grams,
    label: formatGrams(grams),
    priceMxn: presentationPriceMxn(priceMxn || 0, baseGrams, grams),
  }))
}

/** Etiqueta de presentación cuando solo se conoce el texto editorial. */
export function editorialWeightLabel(gramaje: string | null | undefined): string | null {
  const grams = parseWeightGrams(gramaje)
  return grams ? formatGrams(grams) : gramaje ?? null
}

/** Ordena presentaciones por gramaje ascendente a partir de su etiqueta. */
export function gramsFromLabel(label: string | null | undefined): number {
  return parseWeightGrams(label) ?? Number.MAX_SAFE_INTEGER
}
