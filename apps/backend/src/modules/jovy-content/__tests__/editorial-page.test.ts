import { isPubliclyVisible, resolvePublishedAt } from "@jovy/lib/jovy/editorial-page"

describe("editorial page publication rules", () => {
  const now = new Date("2026-11-11T12:00:00.000Z")

  it("excludes drafts and archived pages from the public response", () => {
    expect(isPubliclyVisible({ status: "draft" }, now)).toBe(false)
    expect(isPubliclyVisible({ status: "archived" }, now)).toBe(false)
  })

  it("excludes scheduled pages until their publication time", () => {
    expect(
      isPubliclyVisible(
        { status: "published", published_at: "2026-11-12T12:00:00.000Z" },
        now,
      ),
    ).toBe(false)
  })

  it("publishes immediately when a published page has no explicit date", () => {
    const publishedAt = resolvePublishedAt({ status: "published" })

    expect(publishedAt).toBeInstanceOf(Date)
    expect(isPubliclyVisible({ status: "published" }, now)).toBe(true)
  })
})
