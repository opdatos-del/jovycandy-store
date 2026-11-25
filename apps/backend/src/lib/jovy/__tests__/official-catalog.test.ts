import manifest from "@jovy/data/catalog/official-mx.json"

import {
  buildOfficialProductPlans,
  calculateSyntheticPriceMxn,
  officialCatalogSchema,
  validateOfficialCatalog,
} from "@jovy/lib/jovy/official-catalog"

describe("manifiesto oficial del catálogo mexicano", () => {
  it("valida el snapshot verificado y sus totales", () => {
    const parsed = officialCatalogSchema.parse(manifest)

    expect(parsed.summary).toMatchObject({
      published_products: 61,
      medusa_products: 35,
      variants: 61,
      families: 24,
      categories_with_products: 4,
      media_verified: 173,
      media_unavailable: 0,
    })
    expect(() => validateOfficialCatalog(parsed)).not.toThrow()
  })

  it("agrupa presentaciones del mismo producto sin agrupar sabores", () => {
    const parsed = officialCatalogSchema.parse(manifest)
    const plans = buildOfficialProductPlans(parsed)

    expect(plans).toHaveLength(35)
    expect(plans.flatMap((plan) => plan.variants)).toHaveLength(61)

    const bears = plans.find((plan) => plan.familyId === "gummi-bears")
    expect(bears?.variants.map((variant) => variant.grams)).toEqual([50, 100, 141, 1000])

    const watermelonRings = plans.find(
      (plan) => plan.title === "Rings Sandía",
    )
    const peachRings = plans.find(
      (plan) => plan.title === "Rings Durazno",
    )
    expect(watermelonRings?.variants).toHaveLength(3)
    expect(peachRings?.variants).toHaveLength(3)
    expect(watermelonRings?.externalId).not.toBe(peachRings?.externalId)
  })

  it("usa identidades estables para producto y variante", () => {
    const parsed = officialCatalogSchema.parse(manifest)
    const plan = buildOfficialProductPlans(parsed).find(
      (candidate) => candidate.familyId === "happy-mix",
    )

    expect(plan?.externalId).toBe("jovy-mx:happy-mix:happy-mix")
    expect(plan?.handle).toBe("jovy-mx-happy-mix-happy-mix")
    expect(plan?.variants.map((variant) => variant.sku)).toEqual([
      "JOVY-MX-45",
      "JOVY-MX-96",
    ])
  })

  it("calcula precios sintéticos coherentes por gramaje", () => {
    expect(calculateSyntheticPriceMxn("gomitas_grenetina", 50)).toBe(15)
    expect(calculateSyntheticPriceMxn("gomitas_grenetina", 100)).toBe(25)
    expect(calculateSyntheticPriceMxn("gomitas_grenetina", 500)).toBe(115)
    expect(calculateSyntheticPriceMxn("gomitas_grenetina", 1000)).toBe(215)
    expect(calculateSyntheticPriceMxn("pinatero", 5000, "premium-pi-atero")).toBe(595)

    expect(() => calculateSyntheticPriceMxn("gomitas_grenetina", 0)).toThrow(
      "gramaje debe ser positivo",
    )
  })

  it("rechaza duplicados y productos sin packshot verificado", () => {
    const parsed = officialCatalogSchema.parse(manifest)
    const duplicate = structuredClone(parsed)
    duplicate.products.push(duplicate.products[0])
    expect(() => validateOfficialCatalog(duplicate)).toThrow("ID oficial duplicado")

    const missingImage = structuredClone(parsed)
    missingImage.products[0].media = missingImage.products[0].media.filter(
      (asset) => asset.role !== "packshot",
    )
    expect(() => validateOfficialCatalog(missingImage)).toThrow(
      "sin packshot verificado",
    )
  })
})
