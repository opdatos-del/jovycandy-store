import { expect, test } from "@playwright/test"

import {
  parseCardVisualOverrides,
  resolveCardVisual,
  type CardVisualOverrides,
} from "../src/lib/commerce/card-visual"

const OVERLAY = "https://medusa.example/static/gomitas.webp"
const SWAP = "https://medusa.example/static/swap.webp"

function config(overrides: Partial<CardVisualOverrides>): CardVisualOverrides {
  return {
    mode: null,
    preset: null,
    swapUrl: null,
    overlayUrl: null,
    fullUrl: null,
    background: null,
    durationMs: null,
    intensity: null,
    ...overrides,
  }
}

test.describe("resolver de efectos de ProductCard", () => {
  test("producto sin configuración usa zoom global", () => {
    const visual = resolveCardVisual(null)
    expect(visual.mode).toBe("zoom")
    expect(visual.preset).toBe("jovy-default")
    expect(visual.source).toBe("global")
  })

  test("producto con zoom explícito", () => {
    const visual = resolveCardVisual(config({ mode: "zoom" }))
    expect(visual.mode).toBe("zoom")
    expect(visual.source).toBe("product")
  })

  test("swap válido", () => {
    const visual = resolveCardVisual(config({ mode: "swap", swapUrl: SWAP }))
    expect(visual.mode).toBe("swap")
    expect(visual.swapUrl).toBe(SWAP)
  })

  test("layered válido conserva overlay y composición", () => {
    const visual = resolveCardVisual(
      config({ mode: "layered", overlayUrl: OVERLAY, fullUrl: SWAP, background: "#EAF7E8" }),
    )
    expect(visual.mode).toBe("layered")
    expect(visual.overlayUrl).toBe(OVERLAY)
    expect(visual.fullUrl).toBe(SWAP)
    expect(visual.background).toBe("#EAF7E8")
  })

  test("none explícito no anima", () => {
    const visual = resolveCardVisual(config({ mode: "none" }))
    expect(visual.mode).toBe("none")
    expect(visual.durationMs).toBe(0)
    expect(visual.intensity).toBe(0)
  })

  test("swap sin imagen cae a zoom", () => {
    const visual = resolveCardVisual(config({ mode: "swap" }))
    expect(visual.mode).toBe("zoom")
  })

  test("layered sin overlay cae a zoom", () => {
    const visual = resolveCardVisual(config({ mode: "layered" }))
    expect(visual.mode).toBe("zoom")
  })

  test("preset de familia aplica layered si el producto aporta overlay", () => {
    const visual = resolveCardVisual(config({ overlayUrl: OVERLAY }), {
      familyPreset: "jovy-gummies",
    })
    expect(visual.mode).toBe("layered")
    expect(visual.preset).toBe("jovy-gummies")
    expect(visual.source).toBe("family")
  })

  test("la configuración del producto gana al preset de familia", () => {
    const visual = resolveCardVisual(config({ mode: "zoom", preset: "jovy-default" }), {
      familyPreset: "jovy-gummies",
    })
    expect(visual.mode).toBe("zoom")
    expect(visual.preset).toBe("jovy-default")
    expect(visual.source).toBe("product")
  })

  test("modo y preset desconocidos caen en el comportamiento seguro", () => {
    const visual = resolveCardVisual(
      config({ mode: "explode" as unknown as CardVisualOverrides["mode"], preset: "unknown" }),
    )
    expect(visual.mode).toBe("zoom")
    expect(visual.preset).toBe("jovy-default")
  })

  test("metadata heredada de Rings produce layered sin mutar el objeto", () => {
    const metadata = {
      card_hover_enabled: true,
      card_hover_mode: "layered",
      card_hover_overlay_url: OVERLAY,
      card_hover_full_url: SWAP,
      card_hover_background: "#EAF7E8",
      jovy_seed: "true",
    }
    const snapshot = JSON.stringify(metadata)
    const overrides = parseCardVisualOverrides(metadata)
    const visual = resolveCardVisual(overrides)

    expect(visual.mode).toBe("layered")
    expect(visual.overlayUrl).toBe(OVERLAY)
    expect(visual.background).toBe("#EAF7E8")
    expect(JSON.stringify(metadata)).toBe(snapshot)
  })

  test("URLs inválidas y marcadores se descartan", () => {
    const overrides = parseCardVisualOverrides({
      card_hover_mode: "swap",
      card_hover_swap_url: "URL_REAL_DEL_ASSET",
    })
    expect(overrides?.swapUrl).toBeNull()
    expect(resolveCardVisual(overrides).mode).toBe("zoom")
  })

  test("metadata no relacionada no genera configuración", () => {
    expect(parseCardVisualOverrides({ jovy_seed: "true", jovy_category: "chamoy" })).toBeNull()
  })
})
