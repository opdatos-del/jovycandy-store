import { authenticate, validateAndTransformBody, type MiddlewareRoute } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

export const NoticeInput = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("read"), id: z.string().regex(/^jcn_[A-Za-z0-9]+$/).max(80) }),
  z.strictObject({ action: z.literal("set_marketing_email"), enabled: z.boolean() }),
])
export type NoticeInput = z.infer<typeof NoticeInput>
export const customerNoticeMiddlewares: MiddlewareRoute[] = [
  { matcher: "/store/jovy/customer-notices", methods: ["GET", "POST"], middlewares: [authenticate("customer", ["bearer"])] },
  { matcher: "/store/jovy/customer-notices", methods: ["POST"], middlewares: [validateAndTransformBody(NoticeInput)] },
]
