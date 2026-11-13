import {
  compareEventOrder,
  eventInputSchema,
  eventPublishIssues,
  eventReorderSchema,
  eventTypeInputSchema,
  isEventVisible,
  updateEventInputSchema,
  updateEventTypeInputSchema,
} from "@jovy/lib/jovy/events"

const now = new Date("2026-11-12T12:00:00.000Z")

describe("event publication rules", () => {
  it("only exposes published, enabled events inside their window", () => {
    expect(isEventVisible({ status: "draft", enabled: true }, now)).toBe(false)
    expect(isEventVisible({ status: "archived", enabled: true }, now)).toBe(false)
    expect(isEventVisible({ status: "cancelled", enabled: true }, now)).toBe(false)
    expect(isEventVisible({ status: "published", enabled: false }, now)).toBe(false)
    expect(isEventVisible({ status: "published", enabled: true, starts_at: "2026-11-13T12:00:00.000Z" }, now)).toBe(false)
    expect(isEventVisible({ status: "published", enabled: true, ends_at: "2026-11-11T12:00:00.000Z" }, now)).toBe(false)
    expect(isEventVisible({ status: "published", enabled: true }, now)).toBe(true)
  })

  it("treats event window boundaries as inclusive UTC instants", () => {
    expect(isEventVisible({ status: "published", enabled: true, starts_at: now.toISOString() }, now)).toBe(true)
    expect(isEventVisible({ status: "published", enabled: true, ends_at: now.toISOString() }, now)).toBe(true)
    expect(isEventVisible({ status: "published", enabled: true, starts_at: "2026-11-12T12:00:00.001Z" }, now)).toBe(false)
  })

  it("lists every missing field that blocks publication", () => {
    expect(eventPublishIssues({})).toEqual([
      "título en español",
      "título en inglés",
      "tipo de evento",
      "fecha de inicio",
    ])
    expect(eventPublishIssues({
      title: "Feria Jovy",
      title_en: "Jovy Fair",
      event_type_id: "type_1",
      starts_at: "2026-11-12T16:00:00.000Z",
      ends_at: "2026-11-12T23:00:00.000Z",
    })).toEqual([])
  })

  it("rejects inverted dates even when the remaining fields are complete", () => {
    expect(eventPublishIssues({
      title: "Feria Jovy",
      title_en: "Jovy Fair",
      event_type_id: "type_1",
      starts_at: "2026-11-12T16:00:00.000Z",
      ends_at: "2026-11-12T15:00:00.000Z",
    })).toEqual(["rango de fechas coherente"])
  })

  it("validates the event payload and reorder ids", () => {
    const valid = { title: "Feria Jovy", slug: "feria-jovy" }
    expect(eventInputSchema.safeParse(valid).success).toBe(true)
    expect(eventInputSchema.safeParse({ ...valid, slug: "Feria Jovy" }).success).toBe(false)
    expect(eventInputSchema.safeParse({ ...valid, status: "pending" }).success).toBe(false)
    expect(eventInputSchema.safeParse({ ...valid, starts_at: "2026-11-13T00:00:00.000Z", ends_at: "2026-11-12T00:00:00.000Z" }).success).toBe(false)
    expect(eventInputSchema.safeParse({ ...valid, priority: 1_001 }).success).toBe(false)
    expect(eventReorderSchema.safeParse({ ids: ["a", "b"] }).success).toBe(true)
    expect(eventReorderSchema.safeParse({ ids: ["a", "a"] }).success).toBe(false)
  })

  it("validates event type management payloads", () => {
    expect(eventTypeInputSchema.safeParse({ code: "feria", name: "Feria" }).success).toBe(true)
    expect(eventTypeInputSchema.safeParse({ code: "Feria", name: "Feria" }).success).toBe(false)
    expect(eventTypeInputSchema.safeParse({ code: "feria" }).success).toBe(false)
    expect(updateEventTypeInputSchema.safeParse({ name: "Feria corporativa" }).success).toBe(true)
    expect(updateEventTypeInputSchema.safeParse({}).success).toBe(true)
  })

  it("does not reset status or enabled on a partial event update", () => {
    const patch = updateEventInputSchema.parse({ starts_at: "2026-11-12T16:00:00.000Z" })
    expect(patch).not.toHaveProperty("status")
    expect(patch).not.toHaveProperty("enabled")
    expect(patch).not.toHaveProperty("priority")
    expect(updateEventInputSchema.parse({ status: "cancelled" }).status).toBe("cancelled")
  })
})

describe("deterministic event ordering", () => {
  it("orders by priority DESC, sort_order ASC, starts_at ASC and stable tiebreakers", () => {
    const events = [
      { id: "e-2", priority: 0, sort_order: 1, starts_at: "2026-11-12T18:00:00.000Z" },
      { id: "e-1", priority: 5, sort_order: 9, starts_at: "2026-11-12T20:00:00.000Z" },
      { id: "e-3", priority: 0, sort_order: 0, starts_at: "2026-11-12T19:00:00.000Z" },
      { id: "e-4", priority: 0, sort_order: 1, starts_at: "2026-11-12T17:00:00.000Z" },
    ]
    expect([...events].sort(compareEventOrder).map((event) => event.id)).toEqual(["e-1", "e-3", "e-4", "e-2"])
  })

  it("keeps equal-priority events deterministic when dates are absent", () => {
    const events = [
      { id: "e-b", priority: 0, sort_order: 0, created_at: "2026-11-12T00:00:02.000Z" },
      { id: "e-a", priority: 0, sort_order: 0, created_at: "2026-11-12T00:00:01.000Z" },
    ]
    expect([...events].sort(compareEventOrder).map((event) => event.id)).toEqual(["e-a", "e-b"])
  })
})
