import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { reorderBrandSchema } from "@jovy/lib/jovy/brand"
import { reorderBrandWorkflow } from "@jovy/workflows/jovy-brand/brand"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = reorderBrandSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El orden no es válido", errors: parsed.error.flatten() })
  await reorderBrandWorkflow(req.scope).run({ input: { entity: "gallery", ids: parsed.data.ids, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
