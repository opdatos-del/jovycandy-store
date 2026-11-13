import {
  bannerInputSchema,
  compareBannerOrder,
  compareHeroOrder,
  heroInputSchema,
  isMarketingVisible,
  reorderSchema,
  updateBannerInputSchema,
  updateHeroInputSchema,
} from "@jovy/lib/jovy/marketing"

const now = new Date("2026-11-12T12:00:00.000Z")

const bannerTranslations = {
  es: { title: "Promo DEMO", alt: "Promo DEMO" },
  en: { title: "DEMO promo", alt: "DEMO promo" },
}

describe("marketing publication rules", () => {
  it("only exposes published, enabled and current content", () => {
    expect(isMarketingVisible({ status: "draft", enabled: true }, now)).toBe(false)
    expect(isMarketingVisible({ status: "archived", enabled: true }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: false }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: true, starts_at: "2026-11-13T12:00:00.000Z" }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: true, ends_at: "2026-11-11T12:00:00.000Z" }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: true }, now)).toBe(true)
  })

  it("treats the UTC window boundaries as inclusive", () => {
    expect(isMarketingVisible({ status: "published", enabled: true, starts_at: now.toISOString() }, now)).toBe(true)
    expect(isMarketingVisible({ status: "published", enabled: true, ends_at: now.toISOString() }, now)).toBe(true)
    expect(isMarketingVisible({ status: "published", enabled: true, starts_at: "2026-11-12T12:00:00.001Z" }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: true, ends_at: "2026-11-12T11:59:59.999Z" }, now)).toBe(false)
  })

  it("rejects unsafe CTA URLs and invalid ranges", () => {
    const base = { translations: { es: { title: "Hero DEMO" }, en: { title: "DEMO hero" } } }
    expect(heroInputSchema.safeParse({ ...base, cta_url: "javascript:alert(1)" }).success).toBe(false)
    expect(heroInputSchema.safeParse({ ...base, cta_url: "data:text/html,hola" }).success).toBe(false)
    expect(heroInputSchema.safeParse({ ...base, cta_url: "http://example.com" }).success).toBe(false)
    expect(heroInputSchema.safeParse({ ...base, cta_url: "/tienda" }).success).toBe(true)
    expect(heroInputSchema.safeParse({ ...base, cta_url: "https://example.com/promo" }).success).toBe(true)
    expect(heroInputSchema.safeParse({ ...base, starts_at: "2026-11-13T00:00:00.000Z", ends_at: "2026-11-12T00:00:00.000Z" }).success).toBe(false)
    expect(heroInputSchema.safeParse({ ...base, starts_at: "2026-11-12T00:00:00.000Z", ends_at: "2026-11-12T00:00:00.000Z" }).success).toBe(false)
  })

  it("rejects banner payloads with invalid slot, frequency, priority, alt or CTA", () => {
    const valid = { slot: "promo", translations: bannerTranslations }
    expect(bannerInputSchema.safeParse(valid).success).toBe(true)
    expect(bannerInputSchema.safeParse({ ...valid, slot: "modal" }).success).toBe(false)
    expect(bannerInputSchema.safeParse({ ...valid, frequency: "weekly" }).success).toBe(false)
    expect(bannerInputSchema.safeParse({ ...valid, priority: 1_001 }).success).toBe(false)
    expect(bannerInputSchema.safeParse({ ...valid, priority: -1 }).success).toBe(false)
    expect(bannerInputSchema.safeParse({ ...valid, cta_url: "javascript:alert(1)" }).success).toBe(false)
    expect(bannerInputSchema.safeParse({ ...valid, translations: { es: { title: "Promo" }, en: bannerTranslations.en } }).success).toBe(false)
    expect(bannerInputSchema.safeParse({ ...valid, starts_at: "2026-11-13T00:00:00.000Z", ends_at: "2026-11-12T00:00:00.000Z" }).success).toBe(false)
  })

  it("preserves the original promo frequency values as client preferences", () => {
    const result = bannerInputSchema.safeParse({ slot: "promo", translations: bannerTranslations, frequency: "daily" })
    expect(result.success).toBe(true)
    expect(result.data?.frequency).toBe("daily")
  })

  it("requires unique ids for reordering", () => {
    expect(reorderSchema.safeParse({ ids: ["a", "b"] }).success).toBe(true)
    expect(reorderSchema.safeParse({ ids: ["a", "a"] }).success).toBe(false)
    expect(reorderSchema.safeParse({ ids: [] }).success).toBe(false)
  })

  it("does not inject creation defaults into partial updates", () => {
    const bannerPatch = updateBannerInputSchema.parse({ starts_at: "2026-11-12T00:00:00.000Z" })
    expect(bannerPatch).not.toHaveProperty("status")
    expect(bannerPatch).not.toHaveProperty("enabled")
    expect(bannerPatch).not.toHaveProperty("frequency")
    expect(bannerPatch).not.toHaveProperty("priority")

    const heroPatch = updateHeroInputSchema.parse({ cta_url: "/tienda" })
    expect(heroPatch).not.toHaveProperty("status")
    expect(heroPatch).not.toHaveProperty("enabled")
    expect(heroPatch).not.toHaveProperty("sort_order")
    expect(updateHeroInputSchema.parse({ status: "archived" }).status).toBe("archived")
  })
})

describe("deterministic marketing ordering", () => {
  it("orders banners by priority DESC, then sort_order ASC, then created_at and id", () => {
    const banners = [
      { id: "b-3", priority: 0, sort_order: 1, created_at: "2026-11-12T00:00:02.000Z" },
      { id: "b-1", priority: 5, sort_order: 9, created_at: "2026-11-12T00:00:05.000Z" },
      { id: "b-2", priority: 0, sort_order: 0, created_at: "2026-11-12T00:00:01.000Z" },
      { id: "b-4", priority: 0, sort_order: 1, created_at: "2026-11-12T00:00:02.000Z" },
    ]
    expect([...banners].sort(compareBannerOrder).map((banner) => banner.id)).toEqual(["b-1", "b-2", "b-3", "b-4"])
  })

  it("does not let a reorder bypass an explicit higher priority", () => {
    const lowerPriorityMovingFirst = { id: "moved", priority: 0, sort_order: 0, created_at: "2026-11-12T00:00:01.000Z" }
    const pinned = { id: "pinned", priority: 10, sort_order: 99, created_at: "2026-11-12T00:00:02.000Z" }
    expect([lowerPriorityMovingFirst, pinned].sort(compareBannerOrder).map((banner) => banner.id)).toEqual(["pinned", "moved"])
  })

  it("orders Hero strictly by sort_order with stable tiebreakers", () => {
    const heroes = [
      { id: "hero-b", sort_order: 1, created_at: "2026-11-12T00:00:02.000Z" },
      { id: "hero-a", sort_order: 0, created_at: "2026-11-12T00:00:03.000Z" },
      { id: "hero-c", sort_order: 1, created_at: "2026-11-12T00:00:01.000Z" },
    ]
    expect([...heroes].sort(compareHeroOrder).map((hero) => hero.id)).toEqual(["hero-a", "hero-c", "hero-b"])
  })
})
