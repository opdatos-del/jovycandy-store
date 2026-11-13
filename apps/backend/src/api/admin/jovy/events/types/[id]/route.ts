import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { updateEventTypeInputSchema } from "@jovy/lib/jovy/events"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"
import { deleteEventTypeWorkflow, updateEventTypeWorkflow } from "@jovy/workflows/jovy-events/event-type"

async function getEventType(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_EVENTS_MODULE)
  const [eventType] = await service.listJovyEventTypes({ id: req.params.id })
  if (!eventType) {
    res.status(404).json({ message: "Tipo de evento no encontrado" })
    return null
  }
  return eventType
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const event_type = await getEventType(req, res)
  if (event_type) res.json({ event_type })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = updateEventTypeInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El tipo de evento no es válido", errors: parsed.error.flatten() })
  const current = await getEventType(req, res)
  if (!current) return

  const { result: event_type } = await updateEventTypeWorkflow(req.scope).run({
    input: { id: current.id, ...parsed.data, actor_id: getAdminActorId(req) },
  })
  res.json({ event_type })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const current = await getEventType(req, res)
  if (!current) return

  await deleteEventTypeWorkflow(req.scope).run({ input: { id: current.id, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
