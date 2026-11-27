import { authenticate, validateAndTransformBody, type MiddlewareRoute } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

const title = z.string().trim().min(1).max(80)
const listId = z.string().regex(/^jwl_[A-Za-z0-9]+$/).max(80)
const itemId = z.string().regex(/^jwli_[A-Za-z0-9]+$/).max(80)
const variantId = z.string().regex(/^variant_[A-Za-z0-9]+$/).max(80)

export const CustomerListMutation = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), name: title }),
  z.strictObject({ action: z.literal("rename"), list_id: listId, name: title }),
  z.strictObject({ action: z.literal("delete"), list_id: listId }),
  z.strictObject({ action: z.literal("add"), list_id: z.union([listId, z.literal("favorites")]), variant_id: variantId }),
  z.strictObject({ action: z.literal("remove"), list_id: z.union([listId, z.literal("favorites")]), item_id: itemId }),
])
export type CustomerListMutation = z.infer<typeof CustomerListMutation>

export const customerListMiddlewares: MiddlewareRoute[] = [
  { matcher: "/store/jovy/customer-lists", methods: ["GET", "POST"], middlewares: [authenticate("customer", ["bearer"])] },
  { matcher: "/store/jovy/customer-lists", methods: ["POST"], middlewares: [validateAndTransformBody(CustomerListMutation)] },
]
