import manifest from "@jovy/data/catalog/official-mx.json"

import { buildOfficialProductPlans, officialCatalogSchema } from "../official-catalog"
import {
  inspectOfficialCatalogIntegrity,
  isOfficialCatalogCompletionCurrent,
  officialCatalogManifestFingerprint,
} from "../official-catalog-integrity"

describe("integridad del catálogo oficial", () => {
  const catalog = officialCatalogSchema.parse(manifest)
  const plans = buildOfficialProductPlans(catalog)

  function persistedCatalog() {
    const fingerprint = officialCatalogManifestFingerprint(catalog)
    const products = plans.map((plan) => ({
      id: `prod_${plan.externalId}`,
      external_id: plan.externalId,
      metadata: { jovy_official_managed: true },
      variants: plan.variants.map((variant) => ({
        sku: variant.sku,
        manage_inventory: true,
        allow_backorder: false,
        metadata: { jovy_official_grams: variant.grams },
        prices: [{ currency_code: "mxn" }],
        inventory_items: [{ inventory_item_id: `inv_${variant.sku}` }],
      })),
    }))
    const integrity = inspectOfficialCatalogIntegrity(plans, products)
    return {
      fingerprint,
      products: products.map((product) => ({
        ...product,
        metadata: {
          ...product.metadata,
          jovy_official_catalog_complete: true,
          jovy_official_catalog_manifest_sha256: fingerprint,
          jovy_official_catalog_integrity_sha256: integrity.hash,
        },
      })),
    }
  }

  it("liga el marcador al manifiesto y a invariantes persistidas", () => {
    const { fingerprint, products } = persistedCatalog()

    expect(isOfficialCatalogCompletionCurrent(plans, products, fingerprint)).toBe(true)
    expect(
      isOfficialCatalogCompletionCurrent(plans, products, `${fingerprint}changed`),
    ).toBe(false)
  })

  it("detecta variantes, precio MXN e inventario incompletos", () => {
    const { products } = persistedCatalog()
    products[0].variants![0].prices = []
    products[0].variants![0].inventory_items = []

    expect(inspectOfficialCatalogIntegrity(plans, products).issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("no tiene precio MXN"),
        expect.stringContaining("no tiene inventory item"),
      ]),
    )
  })
})
