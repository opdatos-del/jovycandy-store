import { z } from "@medusajs/framework/zod"

export const contactTypes = ["national-sales", "international-sales", "customer-service", "catalogue"] as const
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

export const DEFAULT_CONTACT_PAGE_SIZE = 20
export const MAX_CONTACT_PAGE_SIZE = 100

export const publicContactSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: optionalText(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: optionalText(40),
  country: optionalText(100),
  city: optionalText(100),
  postal_code: optionalText(30),
  message: z.string().trim().min(1).max(4_000),
  contact_type: z.enum(contactTypes),
  website: z.string().max(200).optional().default(""),
}).strict()

export const updateContactSchema = z.object({
  status: z.enum(["pending", "handled"]).optional(),
  admin_notes: optionalText(4_000),
}).strict()

export const contactListQuerySchema = z.object({
  status: z.enum(["pending", "handled"]).optional(),
  contact_type: z.enum(contactTypes).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_CONTACT_PAGE_SIZE).default(DEFAULT_CONTACT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
}).strict()

export type ContactListQuery = z.infer<typeof contactListQuerySchema>

/**
 * `%` and `_` are LIKE wildcards, so they are escaped to keep a literal search
 * term from matching every row.
 */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

/**
 * The search runs in SQL (`$or` + `$ilike`) instead of in memory, otherwise
 * `take`/`skip` would slice the list before filtering and hide matching rows.
 */
export function contactListFilters(query: Pick<ContactListQuery, "status" | "contact_type" | "q">) {
  const filters: Record<string, unknown> = {}
  if (query.status) filters.status = query.status
  if (query.contact_type) filters.contact_type = query.contact_type
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`
    filters.$or = [
      { first_name: { $ilike: pattern } },
      { last_name: { $ilike: pattern } },
      { email: { $ilike: pattern } },
      { contact_type: { $ilike: pattern } },
    ]
  }
  return filters
}
