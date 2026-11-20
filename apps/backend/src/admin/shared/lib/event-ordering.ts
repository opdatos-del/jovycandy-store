export type PriorityOrderedEvent = { id: string; priority?: number }

/**
 * The Admin list is sorted by `priority DESC`, so events with the same priority
 * are contiguous. `reorder` only rewrites `sort_order`, therefore it can only
 * change the visible order inside one priority group. Arrows are disabled at a
 * priority boundary instead of swapping events that the sort would not move.
 */
export function canMoveEventWithinPriority(
  events: PriorityOrderedEvent[],
  id: string,
  direction: -1 | 1,
) {
  const position = events.findIndex((event) => event.id === id)
  const target = position + direction
  return position >= 0
    && target >= 0
    && target < events.length
    && (events[position].priority ?? 0) === (events[target].priority ?? 0)
}

/**
 * Returns a new array with the adjacent same-priority events swapped, or the
 * original array when the move would cross a priority boundary.
 */
export function moveEventWithinPriority<T extends PriorityOrderedEvent>(
  events: T[],
  id: string,
  direction: -1 | 1,
): T[] {
  if (!canMoveEventWithinPriority(events, id, direction)) return events

  const position = events.findIndex((event) => event.id === id)
  const target = position + direction
  const ordered = [...events]
  ;[ordered[position], ordered[target]] = [ordered[target], ordered[position]]
  return ordered
}
