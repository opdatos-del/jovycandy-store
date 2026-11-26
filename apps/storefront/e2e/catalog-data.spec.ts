import { expect, test } from "@playwright/test"

import {
  getProductPresentations,
  lowestVariantPrice,
  matchesPresentation,
  summarizePresentations,
} from "../src/lib/commerce/product-presentations"
import type { CommerceProduct } from "../src/lib/medusa/store"

const commerce: CommerceProduct = {
  id: "prod_migrated",
  externalId: "jovy-mx:test:test",
  handle: "jovy-mx-test",
  title: "Producto",
  description: null,
  thumbnail: null,
  images: [],
  specs: [],
  cardVisual: null,
  variants: [
    {
      id: "variant_1kg",
      title: "1 kg",
      sku: "JOVY-MX-1",
      grams: 1000,
      manageInventory: true,
      allowBackorder: false,
      inventoryQuantity: 50,
      price: 215,
      currencyCode: "mxn",
    },
    {
      id: "variant_100",
      title: "100 g",
      sku: "JOVY-MX-2",
      grams: 100,
      manageInventory: true,
      allowBackorder: false,
      inventoryQuantity: 50,
      price: 25,
      currencyCode: "mxn",
    },
    {
      id: "variant_unpriced",
      title: "50 g",
      sku: "JOVY-MX-3",
      grams: 50,
      manageInventory: true,
      allowBackorder: false,
      inventoryQuantity: 50,
      price: null,
      currencyCode: null,
    },
  ],
}

test.describe("datos de catálogo", () => {
  test("deriva presentaciones únicas y ordenadas desde variantes", () => {
    expect(getProductPresentations(commerce).map((item) => item.grams)).toEqual([
      50, 100, 1000,
    ])
    expect(summarizePresentations(commerce, null)).toBe("50 g – 1 kg")
    expect(matchesPresentation(commerce, "100 g")).toBe(true)
    expect(matchesPresentation(commerce, "250 g")).toBe(false)
  })

  test("usa el precio mínimo y cuenta variantes con precio", () => {
    expect(lowestVariantPrice(commerce)).toEqual({
      amount: 25,
      currencyCode: "mxn",
      count: 2,
    })
    expect(lowestVariantPrice(null)).toBeNull()
  })

})
