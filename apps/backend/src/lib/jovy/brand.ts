import { z } from "@medusajs/framework/zod"

const status = z.enum(["draft", "published", "archived"])
const id = z.string().trim().min(1).max(255)
const dateTime = z.string().datetime({ offset: true }).nullable().optional()

function validateDateRange(
  input: { starts_at?: string | null; ends_at?: string | null },
  context: z.RefinementCtx,
) {
  if (input.starts_at && input.ends_at && new Date(input.ends_at) <= new Date(input.starts_at)) {
    context.addIssue({
      code: "custom",
      path: ["ends_at"],
      message: "La fecha de fin debe ser posterior a la fecha de inicio",
    })
  }
}

const galleryBaseSchema = z
  .object({
    title: z.string().trim().max(180).nullable().optional(),
    description: z.string().trim().max(2_000).nullable().optional(),
    media_file_id: id,
    status: status.default("draft"),
    enabled: z.boolean().default(true),
    sort_order: z.number().int().min(0).default(0),
    starts_at: dateTime,
    ends_at: dateTime,
  })
  .strict()

export const galleryInputSchema = galleryBaseSchema.superRefine(validateDateRange)
export const updateGalleryInputSchema = galleryBaseSchema.partial().superRefine(validateDateRange)

const logoBaseSchema = z
  .object({
    slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1).max(255),
    alt: z.string().trim().max(255).nullable().optional(),
    families: z.array(z.string().trim().min(1).max(100)).max(30).nullable().optional(),
    media_file_id: id,
    crop: z
      .object({
        zoom: z.number().min(0.25).max(2),
        offset_x: z.number().min(-5_000).max(5_000),
        offset_y: z.number().min(-5_000).max(5_000),
      })
      .nullable()
      .optional(),
    enabled: z.boolean().default(true),
    sort_order: z.number().int().min(0).default(0),
  })
  .strict()

export const logoInputSchema = logoBaseSchema
export const updateLogoInputSchema = logoBaseSchema.partial()
export const reorderBrandSchema = z.object({ ids: z.array(id).min(1).max(200) }).strict()

export function isPublicBrandItem(
  item: { status: string; enabled: boolean; starts_at?: Date | string | null; ends_at?: Date | string | null },
  now = new Date(),
) {
  if (item.status !== "published" || !item.enabled) return false
  const timestamp = now.getTime()
  return (!item.starts_at || new Date(item.starts_at).getTime() <= timestamp) && (!item.ends_at || new Date(item.ends_at).getTime() >= timestamp)
}
