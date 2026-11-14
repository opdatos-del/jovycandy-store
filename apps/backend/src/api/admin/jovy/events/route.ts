import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { compareEventOrder, eventInputSchema } from "@jovy/lib/jovy/events"
import { resolveEventMedia } from "@jovy/lib/jovy/events-media"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"
import { saveEventWorkflow } from "@jovy/workflows/jovy-events/event"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_EVENTS_MODULE)
  const fileModule = req.scope.resolve(Modules.FILE)
  const events = (await service.listJovyEvents({}, { order: { priority: "DESC", sort_order: "ASC", created_at: "ASC" } }))
    .sort(compareEventOrder)

  // La bandeja de Novedades necesita URL y tipo en la misma lectura; el CRUD
  // editorial completo sigue viviendo en la pantalla Eventos.
  const withMedia = await Promise.all(
    events.map(async (event) => ({ ...event, ...(await resolveEventMedia(fileModule, event.media_file_id)) })),
  )

  res.json({ events: withMedia })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = eventInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El evento no es válido", errors: parsed.error.flatten() })
  const { result: event } = await saveEventWorkflow(req.scope).run({ input: { ...parsed.data, actor_id: getAdminActorId(req), action: parsed.data.status === "published" ? "publish" : "create" } })
  res.status(201).json({ event })
}
