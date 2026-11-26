import manifest from "@jovy/scripts/migrations/jovycandy-legacy/manifest.json"

import {
  buildLegacyProductPlans,
  legacyCatalogSchema,
} from "@jovy/lib/jovy/legacy-catalog"
import {
  buildLegacyProductMetadata,
  findLegacyIdentityConflict,
} from "@jovy/lib/jovy/legacy-import"

describe("metadata del importador histórico", () => {
  const plans = buildLegacyProductPlans(legacyCatalogSchema.parse(manifest))
  const ringsApple = plans.find(
    (plan) => plan.externalId === "jovy-mx:rings:rings-manzana",
  )!

  it("detecta external_id o SKU duplicados antes de escribir", () => {
    const sku = ringsApple.variants[0].sku
    const first = {
      id: "p1",
      external_id: ringsApple.externalId,
      variants: [{ id: "v1", sku }],
    }
    expect(findLegacyIdentityConflict([ringsApple], [first])).toBeNull()
    expect(
      findLegacyIdentityConflict([ringsApple], [
        first,
        { id: "p2", external_id: ringsApple.externalId },
      ]),
    ).toContain("external_id duplicado")
    expect(
      findLegacyIdentityConflict([ringsApple], [
        first,
        { id: "p2", variants: [{ id: "v2", sku }] },
      ]),
    ).toContain("SKU duplicado")
  })

  it("registra procedencia y medios sin marcas del subsistema retirado", () => {
    const metadata = buildLegacyProductMetadata(
      ringsApple,
      { abc: "http://localhost:9000/static/abc.webp" },
      { abc: "http://localhost:9000/static/abc.webp" },
    )

    expect(metadata).toMatchObject({
      jovy_legacy_managed: true,
      jovy_legacy_external_id: ringsApple.externalId,
      jovy_legacy_family_id: ringsApple.familyId,
      jovy_legacy_source_updated_at: ringsApple.sourceUpdatedAt,
      jovy_legacy_specs: ringsApple.specs,
      jovy_media_registry: {
        abc: "http://localhost:9000/static/abc.webp",
      },
    })
    expect(metadata).not.toHaveProperty("jovy_official_catalog_complete")
    expect(metadata).not.toHaveProperty("jovy_official_managed")
  })
})
