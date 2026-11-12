import { z } from "@medusajs/framework/zod"

const dateTime = z.string().datetime({ offset: true }).nullable().optional()
const slug = z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug debe usar minúsculas, números y guiones")
const status = z.enum(["draft", "published", "archived", "cancelled"])

const eventBaseSchema = z.object({
  event_type_id: z.string().trim().min(1).max(255).nullable().optional(),
  title: z.string().trim().min(2).max(180),
  slug,
  description: z.string().trim().max(2_000).nullable().optional(),
  content: z.string().trim().max(20_000).nullable().optional(),
  media_file_id: z.string().trim().min(1).max(255).nullable().optional(),
  starts_at: dateTime,
  ends_at: dateTime,
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
export const updateEventInputSchema = eventBaseSchema.partial().superRefine(validateDateRange)
export const eventTypeInputSchema = z.object({ code: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).nullable().optional() })
export const eventReorderSchema = z.object({ ids: z.array(z.string().trim().min(1)).min(1).max(200) })

export function isEventVisible(event: { status: string; enabled: boolean; starts_at?: Date | string | null; ends_at?: Date | string | null }, now = new Date()) {
  if (event.status !== "published" || !event.enabled) return false
  return (!event.starts_at || new Date(event.starts_at).getTime() <= now.getTime()) && (!event.ends_at || new Date(event.ends_at).getTime() >= now.getTime())
}
