import { z } from "@medusajs/framework/zod"
import { AUTHZ_OPERATIONS, AUTHZ_RESOURCE_KEYS } from "./catalog"

// La pertenencia al catálogo se valida en el servicio, que conoce las
// operaciones permitidas por recurso y el trato especial de `*:*`.
const knownResource = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => value === "*" || AUTHZ_RESOURCE_KEYS.includes(value),
    "Recurso desconocido",
  )
const knownOperation = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => value === "*" || AUTHZ_OPERATIONS.some((operation) => operation.key === value),
    "Operación desconocida",
  )

const policySchema = z.object({
  resource: knownResource,
  operation: knownOperation,
})

export const roleCreateSchema = z.object({
  code: z.string().trim().min(3).max(64),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  policies: z.array(policySchema).max(500).default([]),
})

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
})

export const rolePoliciesSchema = z.object({
  policies: z.array(policySchema).max(500),
})

export const userAccessSchema = z.object({
  role_ids: z.array(z.string().min(1)).max(50),
  policies: z
    .array(
      policySchema.extend({
        effect: z.enum(["allow", "deny"]),
      }),
    )
    .max(500),
})
