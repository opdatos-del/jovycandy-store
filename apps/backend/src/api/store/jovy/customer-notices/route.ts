import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { markCustomerNoticeRead, setCustomerMarketingEmail } from "@jovy/workflows/jovy-customer-space/notices"
import type { NoticeInput } from "./middlewares"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "jovy_customer_notice",
    fields: ["id", "kind", "created_at", "read_at"],
    filters: { customer_id: req.auth_context.actor_id },
    pagination: { take: 20, order: { created_at: "DESC" } },
  })
  const { data: [preference] } = await query.graph({
    entity: "jovy_communication_preference",
    fields: ["marketing_email"],
    filters: { customer_id: req.auth_context.actor_id },
    pagination: { take: 1 },
  })
  return res.json({ notices: data, marketingEmail: preference?.marketing_email === true })
}

export async function POST(req: AuthenticatedMedusaRequest<NoticeInput>, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id
  const action = req.validatedBody
  const { result } = action.action === "read"
    ? await markCustomerNoticeRead(req.scope).run({ input: { customerId, id: action.id } })
    : await setCustomerMarketingEmail(req.scope).run({ input: { customerId, enabled: action.enabled } })
  return res.json(result)
}
