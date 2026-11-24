/**
 * Contrato visual de las tarjetas del catálogo.
 *
 * Resuelve el efecto final combinando, en orden:
 *   1. configuración explícita del producto,
 *   2. preset de familia (Jovy CMS),
 *   3. preset global del storefront,
 *   4. fallback seguro `zoom`.
 *
 * Es una función pura: no lee red, DOM ni variables de entorno.
 */

export const CARD_VISUAL_MODES = ["zoom", "swap", "layered", "none"] as const
export type CardVisualMode = (typeof CARD_VISUAL_MODES)[number]

export const CARD_VISUAL_PRESETS = [
  "jovy-default",
  "jovy-gummies",
  "jovy-swap",
  "jovy-none",
] as const
export type CardVisualPresetId = (typeof CARD_VISUAL_PRESETS)[number]

export type CardVisualPreset = {
  mode: CardVisualMode
  durationMs: number
  intensity: number
}

export const CARD_VISUAL_PRESET_DEFINITIONS: Record<CardVisualPresetId, CardVisualPreset> = {
  "jovy-default": { mode: "zoom", durationMs: 350, intensity: 1 },
  "jovy-gummies": { mode: "layered", durationMs: 450, intensity: 1 },
  "jovy-swap": { mode: "swap", durationMs: 350, intensity: 1 },
  "jovy-none": { mode: "none", durationMs: 0, intensity: 0 },
}

export const GLOBAL_CARD_VISUAL_PRESET: CardVisualPresetId = "jovy-default"
const SAFE_FALLBACK: CardVisualPreset = CARD_VISUAL_PRESET_DEFINITIONS["jovy-default"]

/** Sobrescrituras leídas de `product.metadata`; `null` significa heredar. */
export type CardVisualOverrides = {
  mode: CardVisualMode | null
  preset: string | null
  swapUrl: string | null
  overlayUrl: string | null
  fullUrl: string | null
  background: string | null
  durationMs: number | null
  intensity: number | null
}

export type CardVisual = {
  mode: CardVisualMode
  preset: CardVisualPresetId
  swapUrl: string | null
  overlayUrl: string | null
  fullUrl: string | null
  background: string | null
  durationMs: number
  intensity: number
  source: "product" | "family" | "global" | "fallback"
}

export type CardVisualContext = {
  familyPreset?: string | null
  globalPreset?: string | null
}

const PLACEHOLDER_PATTERN = /URL_REAL|REPLACE_ME|TODO|<|>/i
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

export function isCardVisualMode(value: unknown): value is CardVisualMode {
  return typeof value === "string" && (CARD_VISUAL_MODES as readonly string[]).includes(value)
}

export function isCardVisualPreset(value: unknown): value is CardVisualPresetId {
  return typeof value === "string" && (CARD_VISUAL_PRESETS as readonly string[]).includes(value)
}

function publicMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const candidate = value.trim()
  if (!candidate || PLACEHOLDER_PATTERN.test(candidate)) return null
  if (candidate.startsWith("/")) return candidate
  try {
    const url = new URL(candidate)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

function boundedNumber(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

/**
 * Proyección pública de metadata. Solo se aceptan las claves card_hover_*;
 * cualquier otro dato del producto se descarta.
 */
export function parseCardVisualOverrides(metadata: unknown): CardVisualOverrides | null {
  if (!metadata || typeof metadata !== "object") return null
  const data = metadata as Record<string, unknown>

  const enabledValue = data.card_hover_enabled
  const explicitDisabled = enabledValue === false || enabledValue === "false"
  const explicitEnabled = enabledValue === true || enabledValue === "true"
  const rawMode = data.card_hover_mode

  let mode: CardVisualMode | null = null
  if (explicitDisabled) mode = "none"
  else if (isCardVisualMode(rawMode)) mode = rawMode
  else if (explicitEnabled) mode = "layered"

  const preset = isCardVisualPreset(data.card_hover_preset) ? data.card_hover_preset : null
  const swapUrl = publicMediaUrl(data.card_hover_swap_url)
  const overlayUrl = publicMediaUrl(data.card_hover_overlay_url)
  const fullUrl = publicMediaUrl(data.card_hover_full_url)
  const background =
    typeof data.card_hover_background === "string" && HEX_COLOR.test(data.card_hover_background.trim())
      ? data.card_hover_background.trim()
      : null

  const overrides: CardVisualOverrides = {
    mode,
    preset,
    swapUrl,
    overlayUrl,
    fullUrl,
    background,
    durationMs: boundedNumber(data.card_hover_duration_ms, 150, 900),
    intensity: boundedNumber(data.card_hover_intensity, 0, 150),
  }

  const hasAnyValue = Object.values(overrides).some(
    (value) => value !== null && value !== undefined && value !== 0,
  )
  return hasAnyValue ? overrides : null
}

function presetById(value: string | null | undefined): CardVisualPreset | null {
  return isCardVisualPreset(value) ? CARD_VISUAL_PRESET_DEFINITIONS[value] : null
}

/**
 * Efecto final de la tarjeta. Nunca lanza: entradas inválidas caen en `zoom`.
 */
export function resolveCardVisual(
  overrides: CardVisualOverrides | null | undefined,
  context: CardVisualContext = {},
): CardVisual {
  const productPreset = presetById(overrides?.preset ?? null)
  const familyPreset = presetById(context.familyPreset ?? null)
  const globalPreset = presetById(context.globalPreset ?? null) ?? presetById(GLOBAL_CARD_VISUAL_PRESET)

  const base = productPreset ?? familyPreset ?? globalPreset ?? SAFE_FALLBACK
  const preset =
    overrides?.preset && isCardVisualPreset(overrides.preset)
      ? overrides.preset
      : isCardVisualPreset(context.familyPreset)
        ? context.familyPreset
        : isCardVisualPreset(context.globalPreset)
          ? context.globalPreset
          : GLOBAL_CARD_VISUAL_PRESET

  const explicitMode = isCardVisualMode(overrides?.mode) ? overrides?.mode : null
  let mode = explicitMode ?? base.mode
  const intensity = overrides?.intensity !== null && overrides?.intensity !== undefined
    ? overrides.intensity / 100
    : base.intensity

  const swapUrl = overrides?.swapUrl ?? null
  const overlayUrl = overrides?.overlayUrl ?? null
  const fullUrl = overrides?.fullUrl ?? null

  // Un modo que requiere un recurso ausente no debe romper la tarjeta.
  if (mode === "swap" && !swapUrl) mode = "zoom"
  if (mode === "layered" && !overlayUrl) mode = "zoom"

  const source: CardVisual["source"] =
    explicitMode != null
      ? "product"
      : context.familyPreset && isCardVisualPreset(context.familyPreset)
        ? "family"
        : "global"

  return {
    mode,
    preset,
    swapUrl,
    overlayUrl,
    fullUrl,
    background: overrides?.background ?? null,
    durationMs: mode === "none" ? 0 : overrides?.durationMs ?? base.durationMs,
    intensity: mode === "none" ? 0 : intensity,
    source,
  }
}

/** Atributos CSS listos para el motor visual. */
export function cardVisualStyle(visual: CardVisual): Record<string, string> {
  return {
    "--visual-duration": `${visual.durationMs}ms`,
    "--visual-intensity": `${Math.max(0, visual.intensity)}`,
    "--visual-scale": `${(1 + 0.04 * Math.max(0, visual.intensity)).toFixed(3)}`,
    ...(visual.background ? { "--card-hover-bg": visual.background } : {}),
  }
}
