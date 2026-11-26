import manifest from "@jovy/data/catalog/official-mx.json"

import {
  buildOfficialProductPlans,
  officialCatalogSchema,
} from "@jovy/lib/jovy/official-catalog"
import {
  findOfficialIdentityConflict,
  inheritRingsVisualMetadata,
  mergeOfficialProductMetadata,
  RINGS_VISUAL_SOURCE_HANDLE,
} from "@jovy/lib/jovy/official-catalog-seed"

describe("metadata del seed oficial", () => {
  const plans = buildOfficialProductPlans(officialCatalogSchema.parse(manifest))
  const ringsApple = plans.find(
    (plan) => plan.externalId === "jovy-mx:rings:rings-manzana",
  )!
  const ringsWatermelon = plans.find(
    (plan) => plan.externalId === "jovy-mx:rings:rings-sandia",
  )!

  it("detecta external_id o SKU oficial duplicados antes de escribir", () => {
    const sku = ringsApple.variants[0].sku
    const first = { id: "p1", external_id: ringsApple.externalId, variants: [{ id: "v1", sku }] }
    expect(findOfficialIdentityConflict([ringsApple], [first])).toBeNull()
    expect(findOfficialIdentityConflict([ringsApple], [first, { id: "p2", external_id: ringsApple.externalId }])).toContain("external_id duplicado")
    expect(findOfficialIdentityConflict([ringsApple], [first, { id: "p2", variants: [{ id: "v2", sku }] }])).toContain("SKU duplicado")
    expect(findOfficialIdentityConflict([ringsApple], [{ ...first, variants: [{ id: "v1", sku }, { id: "v2", sku }] }])).toContain("SKU duplicado")
  })

  it("hereda la capa layered histórica solo en Rings Manzana", () => {
    const inherited = inheritRingsVisualMetadata(ringsApple, [
      {
        handle: RINGS_VISUAL_SOURCE_HANDLE,
        metadata: {
          card_hover_mode: "layered",
          card_hover_overlay_url: "http://localhost:9000/static/overlay.webp",
          card_hover_background: "#EAF7E8",
          card_visual_version: 1,
          card_hover_swap_url: null,
          jovy_seed: "true",
        },
      },
    ])

    expect(inherited).toEqual({
      card_hover_mode: "layered",
      card_hover_overlay_url: "http://localhost:9000/static/overlay.webp",
      card_hover_background: "#EAF7E8",
      card_visual_version: 1,
    })
    expect(inheritRingsVisualMetadata(ringsWatermelon, [])).toEqual({})
  })

  it("conserva la fecha y especificaciones existentes cuando cambia la fuente", () => {
    const previous = {
      jovy_official_updated_at: "fecha-anterior",
      jovy_official_specs: { manual: "conservar" },
      manual_note: "editado en Admin",
    }
    const result = mergeOfficialProductMetadata(ringsApple, {}, previous)

    expect(result.jovy_official_updated_at).toBe(previous.jovy_official_updated_at)
    expect(result.jovy_official_specs).toEqual(previous.jovy_official_specs)
    expect(result.manual_note).toBe(previous.manual_note)
  })

  it("aplica la herencia al crear pero conserva ediciones manuales al repetir", () => {
    const inherited = {
      card_hover_mode: "layered",
      card_hover_overlay_url: "http://localhost:9000/static/overlay.webp",
    }
    const created = mergeOfficialProductMetadata(
      ringsApple,
      { abc: "http://localhost:9000/static/abc.webp" },
      null,
      inherited,
    )

    expect(created).toMatchObject({
      ...inherited,
      jovy_official_managed: true,
      jovy_official_external_id: ringsApple.externalId,
      jovy_synthetic_prices: true,
    })

    const repeated = mergeOfficialProductMetadata(
      ringsApple,
      { def: "http://localhost:9000/static/def.webp" },
      {
        ...created,
        card_hover_mode: "none",
        manual_note: "conservar",
      },
      inherited,
    )

    expect(repeated.card_hover_mode).toBe("none")
    expect(repeated.manual_note).toBe("conservar")
    expect(repeated.jovy_media_registry).toEqual({
      abc: "http://localhost:9000/static/abc.webp",
      def: "http://localhost:9000/static/def.webp",
    })

    const backfilled = mergeOfficialProductMetadata(
      ringsApple,
      {},
      { manual_note: "conservar" },
      inherited,
    )
    expect(backfilled).toMatchObject(inherited)
    expect(backfilled.manual_note).toBe("conservar")
  })
})
