import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { eventInputSchema, updateEventInputSchema } from "@jovy/lib/jovy/events"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"
import { deleteEventWorkflow, saveEventWorkflow } from "@jovy/workflows/jovy-events/event"

async function getEvent(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_EVENTS_MODULE)
  const [event] = await service.listJovyEvents({ id: req.params.id })
  if (!event) {
    res.status(404).json({ message: "Evento no encontrado" })
    return null
  }
  return event
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const event = await getEvent(req, res)
  if (event) res.json({ event })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const patch = updateEventInputSchema.safeParse(req.body)
  if (!patch.success) return res.status(400).json({ message: "El evento no es válido", errors: patch.error.flatten() })
  const current = await getEvent(req, res)
  if (!current) return
  const input = eventInputSchema.safeParse({ ...current, ...patch.data, starts_at: patch.data.starts_at ?? current.starts_at?.toISOString() ?? null, ends_at: patch.data.ends_at ?? current.ends_at?.toISOString() ?? null })
  if (!input.success) return res.status(400).json({ message: "El evento no es válido", errors: input.error.flatten() })
  const action = input.data.status === "published" && current.status !== "published" ? "publish" : input.data.status === "archived" ? "archive" : current.status === "published" && input.data.status !== "published" ? "unpublish" : "update"
  const { result: event } = await saveEventWorkflow(req.scope).run({ input: { ...input.data, id: current.id, actor_id: getAdminActorId(req), action } })
  res.json({ event })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const current = await getEvent(req, res)
  if (!current) return
  await deleteEventWorkflow(req.scope).run({ input: { id: current.id, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
