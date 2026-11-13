import { MedusaError } from "@medusajs/framework/utils"
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
  .refine((value) => new Set(value.ids).size === value.ids.length, "Los identificadores no deben repetirse")

/** Casa Jovy Galería never shows more than four published items at the same instant. */
export const MAX_VISIBLE_GALLERY_ITEMS = 4
/** Locking Module key shared by every write that can change gallery visibility. */
export const GALLERY_VISIBILITY_LOCK = "jovy-brand:gallery-visible-limit"
/** Locking Module key shared by logo writes. */
export const LOGO_LOCK = "jovy-brand:logos"

/**
 * A missing `starts_at` opens the window at the earliest representable instant and a
 * missing `ends_at` closes it at the latest one, so an unbounded window always counts.
 */
const MIN_TIME = -8_640_000_000_000_000
const MAX_TIME = 8_640_000_000_000_000

export type BrandVisibilityWindow = {
  status: string
  enabled: boolean
  starts_at?: Date | string | null
  ends_at?: Date | string | null
}

/**
 * Publication windows are closed intervals `[starts_at, ends_at]` in UTC:
 * both boundaries are inclusive, so a window that ends exactly when another
 * starts (`a.ends_at == b.starts_at`) counts as two simultaneous items at that
 * instant. `galleryInputSchema` rejects `ends_at <= starts_at`, so a zero-length
 * window cannot be persisted through the API; the sweep below still handles it.
 */
export function brandWindowStart(item: Pick<BrandVisibilityWindow, "starts_at">) {
  return item.starts_at ? new Date(item.starts_at).getTime() : MIN_TIME
}

export function brandWindowEnd(item: Pick<BrandVisibilityWindow, "ends_at">) {
  return item.ends_at ? new Date(item.ends_at).getTime() : MAX_TIME
}

export function isBrandWindowActiveAt(item: BrandVisibilityWindow, at: number) {
  return brandWindowStart(item) <= at && brandWindowEnd(item) >= at
}

/**
 * Highest number of published, enabled items that are simultaneously visible.
 * Only the window boundaries can change the count, so the sweep visits them
 * instead of the whole timeline.
 */
export function maxSimultaneousBrandItems(items: BrandVisibilityWindow[]) {
  const visible = items.filter((item) => item.status === "published" && item.enabled)
  const boundaries = new Set<number>()
  for (const item of visible) {
    boundaries.add(brandWindowStart(item))
    boundaries.add(brandWindowEnd(item))
  }

  let maximum = 0
  for (const boundary of boundaries) {
    const simultaneous = visible.filter((item) => isBrandWindowActiveAt(item, boundary)).length
    maximum = Math.max(maximum, simultaneous)
  }
  return maximum
}

export function assertBrandVisibilityLimit(items: BrandVisibilityWindow[]) {
  if (maxSimultaneousBrandItems(items) > MAX_VISIBLE_GALLERY_ITEMS) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Casa Jovy Galería solo permite cuatro elementos activos publicados en el mismo periodo",
    )
  }
}

export function isPublicBrandItem(
  item: { status: string; enabled: boolean; starts_at?: Date | string | null; ends_at?: Date | string | null },
  now = new Date(),
) {
  if (item.status !== "published" || !item.enabled) return false
  return isBrandWindowActiveAt(item, now.getTime())
}
