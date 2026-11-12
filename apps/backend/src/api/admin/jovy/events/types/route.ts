import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { eventTypeInputSchema } from "@jovy/lib/jovy/events"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"
import { createEventTypeWorkflow } from "@jovy/workflows/jovy-events/event-type"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_EVENTS_MODULE)
  const event_types = await service.listJovyEventTypes({}, { order: { name: "ASC" } })
  res.json({ event_types })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = eventTypeInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El tipo de evento no es válido", errors: parsed.error.flatten() })
  const { result: event_type } = await createEventTypeWorkflow(req.scope).run({
    input: { ...parsed.data, actor_id: getAdminActorId(req) },
  })
  res.status(201).json({ event_type })
}
