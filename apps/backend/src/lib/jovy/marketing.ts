import { z } from "@medusajs/framework/zod"

export const editorialStatusSchema = z.enum(["draft", "published", "archived"])
export const bannerSlotSchema = z.enum(["promo", "hint"])

const dateTime = z.string().datetime({ offset: true }).nullable().optional()
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable()
const safeCtaUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.startsWith("/") || value.startsWith("https://"), "La URL debe ser relativa o HTTPS")
  .optional()
  .nullable()

const localizedContent = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2_000).optional(),
  cta_label: z.string().trim().max(80).optional(),
})

const heroInputBaseSchema = z.object({
  translations: z.object({ es: localizedContent, en: localizedContent }),
  status: editorialStatusSchema.default("draft"),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
  background_color: hexColor,
  media_file_id: z.string().trim().min(1).max(255).optional().nullable(),
  cta_url: safeCtaUrl,
  starts_at: dateTime,
  ends_at: dateTime,
  product_id: z.string().trim().min(1).max(255).optional().nullable(),
})

export const heroInputSchema = heroInputBaseSchema.superRefine(validateDateRange)

const bannerInputBaseSchema = z.object({
  slot: bannerSlotSchema,
  translations: z.object({
    es: localizedContent.extend({ alt: z.string().trim().min(1).max(255) }),
    en: localizedContent.extend({ alt: z.string().trim().min(1).max(255) }),
  }),
  status: editorialStatusSchema.default("draft"),
  enabled: z.boolean().default(true),
  auto_open: z.boolean().default(false),
  frequency: z.enum(["every", "session", "daily"]).default("every"),
  priority: z.number().int().min(0).max(1000).default(0),
  sort_order: z.number().int().min(0).default(0),
  media_file_id: z.string().trim().min(1).max(255).optional().nullable(),
  cta_url: safeCtaUrl,
  starts_at: dateTime,
  ends_at: dateTime,
})

export const bannerInputSchema = bannerInputBaseSchema.superRefine(validateDateRange)
export const updateHeroInputSchema = heroInputBaseSchema.partial().superRefine(validateDateRange)
export const updateBannerInputSchema = bannerInputBaseSchema.partial().superRefine(validateDateRange)
export const reorderSchema = z.object({ ids: z.array(z.string().trim().min(1)).min(1).max(200) })
export const heroSettingsSchema = z.object({ background_color: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/) })

export type HeroInput = z.infer<typeof heroInputSchema>
export type BannerInput = z.infer<typeof bannerInputSchema>

export function isMarketingVisible(item: {
  status: string
  enabled: boolean
  starts_at?: Date | string | null
  ends_at?: Date | string | null
}, now = new Date()) {
  if (item.status !== "published" || !item.enabled) return false
  const time = now.getTime()
  return (!item.starts_at || new Date(item.starts_at).getTime() <= time)
    && (!item.ends_at || new Date(item.ends_at).getTime() >= time)
}

export function resolvePublishedAt(status: string, value?: string | null, existing?: Date | null) {
  if (status !== "published") return value === undefined ? existing ?? null : value ? new Date(value) : null
  return value ? new Date(value) : existing ?? new Date()
}

function validateDateRange(input: { starts_at?: string | null; ends_at?: string | null }, ctx: z.RefinementCtx) {
  if (input.starts_at && input.ends_at && new Date(input.ends_at) <= new Date(input.starts_at)) {
    ctx.addIssue({ code: "custom", path: ["ends_at"], message: "La fecha de fin debe ser posterior a la fecha de inicio" })
  }
}
