import manifest from "@jovy/data/catalog/official-mx.json"

import { buildOfficialProductPlans, officialCatalogSchema } from "../official-catalog"
import {
  buildOfficialCatalogPreview,
  officialCatalogPatchForFields,
} from "../official-catalog-preview"

describe("preview administrativo del catálogo oficial", () => {
  const [plan] = buildOfficialProductPlans(officialCatalogSchema.parse(manifest))

  it("muestra cada diferencia sin proponer escribir variantes o precios", () => {
    const [preview] = buildOfficialCatalogPreview([plan], [
      {
        id: "prod_1",
        external_id: plan.externalId,
        title: "Título manual",
        description: "Descripción manual",
        weight: 1,
        variants: [
          {
            sku: plan.variants[0].sku,
            title: "Presentación manual",
            metadata: { jovy_official_grams: 1 },
            prices: [],
          },
        ],
      },
    ])

    expect(preview.state).toBe("different")
    expect(preview.changes.map((change) => change.field)).toEqual(
      expect.arrayContaining(["title", "description", "weight"]),
    )
    expect(preview.variants[0]).toMatchObject({
      state: "different",
      hasMxnPrice: false,
    })
    expect(preview.diagnostics.map((diagnostic) => diagnostic.field)).toEqual(
      expect.arrayContaining(["status", "category", "family", "specs"]),
    )
    expect(officialCatalogPatchForFields(plan, ["title"])).toEqual({
      title: plan.title,
    })
  })
})
