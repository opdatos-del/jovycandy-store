import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { eventReorderSchema } from "@jovy/lib/jovy/events"
import { reorderEventsWorkflow } from "@jovy/workflows/jovy-events/event"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = eventReorderSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El orden no es válido", errors: parsed.error.flatten() })
  await reorderEventsWorkflow(req.scope).run({ input: { ids: parsed.data.ids, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
