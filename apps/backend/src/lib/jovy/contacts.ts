import { z } from "@medusajs/framework/zod"

export const contactTypes = ["national-sales", "international-sales", "customer-service", "catalogue"] as const
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

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
}).strict()
