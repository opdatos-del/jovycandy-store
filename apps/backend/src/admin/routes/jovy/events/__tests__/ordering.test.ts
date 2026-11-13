import { canMoveEventWithinPriority, moveEventWithinPriority } from "../ordering"

const events = [
  { id: "high", priority: 10, sort_order: 0 },
  { id: "a", priority: 5, sort_order: 0 },
  { id: "b", priority: 5, sort_order: 1 },
  { id: "low", priority: 0, sort_order: 0 },
]

describe("reordenamiento de eventos por grupo de prioridad", () => {
  it("intercambia únicamente vecinos con la misma prioridad", () => {
    expect(moveEventWithinPriority(events, "b", -1).map((event) => event.id)).toEqual(["high", "b", "a", "low"])
    expect(moveEventWithinPriority(events, "a", 1).map((event) => event.id)).toEqual(["high", "b", "a", "low"])
  })

  it("no cruza el límite entre prioridades distintas", () => {
    expect(moveEventWithinPriority(events, "a", -1)).toBe(events)
    expect(moveEventWithinPriority(events, "b", 1)).toBe(events)
    expect(canMoveEventWithinPriority(events, "a", -1)).toBe(false)
    expect(canMoveEventWithinPriority(events, "b", 1)).toBe(false)
    expect(canMoveEventWithinPriority(events, "b", -1)).toBe(true)
  })

  it("deshabilita los extremos de la lista y los identificadores ausentes", () => {
    expect(canMoveEventWithinPriority(events, "high", -1)).toBe(false)
    expect(canMoveEventWithinPriority(events, "low", 1)).toBe(false)
    expect(canMoveEventWithinPriority(events, "missing", -1)).toBe(false)
    expect(moveEventWithinPriority(events, "missing", 1)).toBe(events)
  })

  it("trata la prioridad ausente como cero", () => {
    const unordered = [{ id: "one" }, { id: "two" }]
    expect(moveEventWithinPriority(unordered, "two", -1).map((event) => event.id)).toEqual(["two", "one"])
  })
})
