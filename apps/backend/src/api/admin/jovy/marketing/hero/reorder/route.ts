import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { reorderSchema } from "@jovy/lib/jovy/marketing"
import { reorderMarketingWorkflow } from "@jovy/workflows/jovy-marketing/reorder"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = reorderSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El orden no es válido", errors: parsed.error.flatten() })
  await reorderMarketingWorkflow(req.scope).run({ input: { entity: "hero_item", ids: parsed.data.ids, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
