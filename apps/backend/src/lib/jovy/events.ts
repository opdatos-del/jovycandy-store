import { z } from "@medusajs/framework/zod"

const dateTime = z.string().datetime({ offset: true }).nullable().optional()
const slug = z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug debe usar minúsculas, números y guiones")
const status = z.enum(["draft", "published", "archived", "cancelled"])

const eventFields = {
  event_type_id: z.string().trim().min(1).max(255).nullable().optional(),
  title: z.string().trim().min(2).max(180),
  title_en: z.string().trim().min(2).max(180).nullable().optional(),
  slug,
  description: z.string().trim().max(2_000).nullable().optional(),
  content: z.string().trim().max(20_000).nullable().optional(),
  media_file_id: z.string().trim().min(1).max(255).nullable().optional(),
  starts_at: dateTime,
  ends_at: dateTime,
  status,
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(1_000),
  sort_order: z.number().int().min(0),
}

const eventBaseSchema = z.object({
  ...eventFields,
  status: status.default("draft"),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(1_000).default(0),
  sort_order: z.number().int().min(0).default(0),
})

const validateDateRange = (input: { starts_at?: string | null; ends_at?: string | null }, ctx: z.RefinementCtx) => {
  if (input.starts_at && input.ends_at && new Date(input.ends_at) <= new Date(input.starts_at)) {
    ctx.addIssue({ code: "custom", path: ["ends_at"], message: "La fecha de fin debe ser posterior a la fecha de inicio" })
  }
}

export const eventInputSchema = eventBaseSchema.superRefine(validateDateRange)
// A partial PUT must not restore creation defaults (`status: draft`, `enabled: true`).
export const updateEventInputSchema = z.object(eventFields).partial().superRefine(validateDateRange)
export const eventTypeInputSchema = z.object({ code: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).nullable().optional() })
export const updateEventTypeInputSchema = eventTypeInputSchema.partial()
export const eventReorderSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(200)
    .refine((ids) => new Set(ids).size === ids.length, "Los identificadores no deben repetirse"),
})

export function isEventVisible(event: { status: string; enabled: boolean; starts_at?: Date | string | null; ends_at?: Date | string | null }, now = new Date()) {
  if (event.status !== "published" || !event.enabled) return false
  return (!event.starts_at || new Date(event.starts_at).getTime() <= now.getTime()) && (!event.ends_at || new Date(event.ends_at).getTime() >= now.getTime())
}

/**
 * Publication gate for events. `cancelled` is intentionally not a publishable
 * status: the public API hides it, so publishing it would create a confusing
 * intermediate state. The returned values are field names, never user data.
 */
export function eventPublishIssues(event: {
  title?: string | null
  title_en?: string | null
  event_type_id?: string | null
  starts_at?: Date | string | null
  ends_at?: Date | string | null
}) {
  const issues: string[] = []
  if (!event.title || event.title.trim().length < 2) issues.push("título en español")
  if (!event.title_en || event.title_en.trim().length < 2) issues.push("título en inglés")
  if (!event.event_type_id) issues.push("tipo de evento")
  if (!event.starts_at) {
    issues.push("fecha de inicio")
  } else if (event.ends_at && new Date(event.ends_at).getTime() <= new Date(event.starts_at).getTime()) {
    issues.push("rango de fechas coherente")
  }
  return issues
}

export function compareEventOrder(
  a: { priority?: number; sort_order: number; starts_at?: Date | string | null; created_at?: Date | string | null; id?: string },
  b: { priority?: number; sort_order: number; starts_at?: Date | string | null; created_at?: Date | string | null; id?: string },
) {
  const priority = (b.priority ?? 0) - (a.priority ?? 0)
  if (priority !== 0) return priority
  const sortOrder = a.sort_order - b.sort_order
  if (sortOrder !== 0) return sortOrder
  if (a.starts_at && b.starts_at) {
    const startA = new Date(a.starts_at).getTime()
    const startB = new Date(b.starts_at).getTime()
    if (Number.isFinite(startA) && Number.isFinite(startB) && startA !== startB) return startA - startB
  }
  if (a.created_at && b.created_at) {
    const createdA = new Date(a.created_at).getTime()
    const createdB = new Date(b.created_at).getTime()
    if (Number.isFinite(createdA) && Number.isFinite(createdB) && createdA !== createdB) return createdA - createdB
  }
  return (a.id ?? "").localeCompare(b.id ?? "")
}
