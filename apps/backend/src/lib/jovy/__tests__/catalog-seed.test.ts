import {
  JOVY_SEED_CATEGORIES,
  JOVY_SEED_PRODUCTS,
  jovySeedImage,
} from "@jovy/lib/jovy/catalog-seed"
import { CATALOGUE_CATEGORY_KEYS } from "@jovy/lib/jovy/catalogue"
import { PRODUCT_CERTIFICATIONS } from "@jovy/lib/jovy/product-editorial"

const CATEGORY_KEYS_LENGTH = CATALOGUE_CATEGORY_KEYS.length

describe("seed del catálogo Jovy", () => {
  it("incluye al menos 20 productos con handles únicos", () => {
    expect(JOVY_SEED_PRODUCTS.length).toBeGreaterThanOrEqual(20)
    const handles = JOVY_SEED_PRODUCTS.map((product) => product.handle)
    expect(new Set(handles).size).toBe(handles.length)
  })

  it("usa claves de categoría y certificaciones válidas", () => {
    const validCategories = new Set(CATALOGUE_CATEGORY_KEYS)
    const validCertifications = new Set(PRODUCT_CERTIFICATIONS)

    for (const product of JOVY_SEED_PRODUCTS) {
      expect(validCategories.has(product.categoryKey)).toBe(true)
      expect(product.certifications.every((value) => validCertifications.has(value))).toBe(true)
      expect(product.priceMxn).toBeGreaterThan(0)
      expect(jovySeedImage(product.imageFile)).toMatch(/^https:\/\//)
    }
  })

  it("cubre las seis tarjetas con familias y handles únicos", () => {
    const categoryKeys = JOVY_SEED_CATEGORIES.map((category) => category.key)
    const familySlugs = JOVY_SEED_CATEGORIES.map((category) => category.familySlug)
    const handles = JOVY_SEED_CATEGORIES.map((category) => category.handle)

    expect(new Set(categoryKeys).size).toBe(CATEGORY_KEYS_LENGTH)
    expect(new Set(familySlugs).size).toBe(CATEGORY_KEYS_LENGTH)
    expect(new Set(handles).size).toBe(CATEGORY_KEYS_LENGTH)

    for (const key of CATALOGUE_CATEGORY_KEYS) {
      expect(JOVY_SEED_PRODUCTS.some((product) => product.categoryKey === key)).toBe(true)
    }
  })
})
