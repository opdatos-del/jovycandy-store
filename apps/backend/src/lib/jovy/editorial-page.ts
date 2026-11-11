import { z } from "@medusajs/framework/zod"

const slug = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug debe usar minúsculas, números y guiones")

const localizedContent = z.object({
  title: z.string().trim().min(2).max(180),
  excerpt: z.string().trim().max(320).optional(),
  body: z.string().trim().max(50_000).optional(),
})

const localizedSeo = z.object({
  title: z.string().trim().max(180).optional(),
  description: z.string().trim().max(320).optional(),
  image_file_id: z.string().trim().min(1).max(255).optional(),
})

const translations = z.object({
  es: localizedContent,
  en: localizedContent,
})

const seo = z
  .object({
    es: localizedSeo.optional(),
    en: localizedSeo.optional(),
  })
  .optional()

export const createEditorialPageSchema = z.object({
  slug,
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  translations,
  seo,
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
})

export const updateEditorialPageSchema = createEditorialPageSchema
  .omit({ slug: true })
  .partial()
  .extend({ slug: slug.optional() })

export type CreateEditorialPageInput = z.infer<typeof createEditorialPageSchema>
export type UpdateEditorialPageInput = z.infer<typeof updateEditorialPageSchema>

export function resolvePublishedAt(input: {
  status?: "draft" | "published" | "archived"
  published_at?: string | null
}, existing?: Date | null) {
  if (input.status !== "published") {
    return input.published_at === undefined ? existing ?? null : input.published_at ? new Date(input.published_at) : null
  }

  if (input.published_at) {
    return new Date(input.published_at)
  }

  return existing ?? new Date()
}

export function isPubliclyVisible(page: {
  status: string
  published_at?: Date | string | null
}, now = new Date()) {
  if (page.status !== "published") {
    return false
  }

  if (!page.published_at) {
    return true
  }

  return new Date(page.published_at).getTime() <= now.getTime()
}
