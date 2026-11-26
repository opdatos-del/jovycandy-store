import path from "node:path"

import {
  canManageCardVisual,
  loadCardVisualManifest,
  readVerifiedCardVisualAsset,
  RINGS_VISUAL_DEFAULT_HANDLE,
  RINGS_VISUAL_MARKER,
} from "../card-visual-assets"

describe("paquete visual de Rings", () => {
  const directory = path.resolve(process.cwd(), "src", "data", "card-visuals", "rings")

  it("declara procedencia, producto y los cuatro recursos verificables", async () => {
    const manifest = await loadCardVisualManifest(directory)

    expect(manifest.product_handle).toBe(RINGS_VISUAL_DEFAULT_HANDLE)
    expect(manifest.preset).toBe("jovy-gummies")
    expect(new Set(manifest.assets.map((asset) => asset.role))).toEqual(
      new Set(["base", "full", "overlay", "gummy"]),
    )
    for (const asset of manifest.assets) {
      expect(asset.provenance.length).toBeGreaterThan(10)
      expect((await readVerifiedCardVisualAsset(directory, asset)).byteLength).toBe(
        asset.bytes,
      )
    }
    expect(RINGS_VISUAL_MARKER).toBe("jovy-rings-assets-v1")
  })

  it("respeta una configuración manual y sólo la reemplaza con autorización", () => {
    expect(canManageCardVisual(null)).toBe(true)
    expect(canManageCardVisual({})).toBe(true)
    expect(canManageCardVisual({ card_hover_mode: "swap" })).toBe(false)
    expect(canManageCardVisual({ card_hover_mode: "swap" }, true)).toBe(true)
    expect(
      canManageCardVisual({
        card_hover_mode: "layered",
        card_visual_managed_by: RINGS_VISUAL_MARKER,
      }),
    ).toBe(true)
  })

  it("rechaza un archivo cuyo hash no coincide", async () => {
    const manifest = await loadCardVisualManifest(directory)
    const asset = { ...manifest.assets[0], sha256: "0".repeat(64) }

    await expect(readVerifiedCardVisualAsset(directory, asset)).rejects.toThrow(
      "no coincide con el manifiesto",
    )
  })
})
