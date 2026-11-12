import { bannerInputSchema, heroInputSchema, isMarketingVisible } from "@jovy/lib/jovy/marketing"

const now = new Date("2026-11-12T12:00:00.000Z")

describe("marketing publication rules", () => {
  it("only exposes published, enabled and current content", () => {
    expect(isMarketingVisible({ status: "draft", enabled: true }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: false }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: true, starts_at: "2026-11-13T12:00:00.000Z" }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: true, ends_at: "2026-11-11T12:00:00.000Z" }, now)).toBe(false)
    expect(isMarketingVisible({ status: "published", enabled: true }, now)).toBe(true)
  })

  it("rejects unsafe CTA URLs and invalid ranges", () => {
    const base = { translations: { es: { title: "Hero DEMO" }, en: { title: "DEMO hero" } } }
    expect(heroInputSchema.safeParse({ ...base, cta_url: "javascript:alert(1)" }).success).toBe(false)
    expect(heroInputSchema.safeParse({ ...base, starts_at: "2026-11-13T00:00:00.000Z", ends_at: "2026-11-12T00:00:00.000Z" }).success).toBe(false)
  })

  it("preserves the original promo frequency values as client preferences", () => {
    const result = bannerInputSchema.safeParse({
      slot: "promo",
      translations: { es: { title: "Promo DEMO", alt: "Promo DEMO" }, en: { title: "DEMO promo", alt: "DEMO promo" } },
      frequency: "daily",
    })
    expect(result.success).toBe(true)
    expect(result.data?.frequency).toBe("daily")
  })
})
