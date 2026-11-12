import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { isEventVisible } from "@jovy/lib/jovy/events"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_EVENTS_MODULE)
  const fileModule = req.scope.resolve(Modules.FILE)
  const events = (await service.listJovyEvents({}, { order: { priority: "DESC", sort_order: "ASC", starts_at: "ASC", created_at: "ASC" } })).filter((event) => isEventVisible(event))
  const visibleEvents = await Promise.all(events.map(async (event) => {
    let media_url: string | null = null
    if (event.media_file_id) {
      try { media_url = (await fileModule.retrieveFile(event.media_file_id)).url } catch { /* A missing local laboratory file does not expose an internal error. */ }
    }
    return { id: event.id, event_type_id: event.event_type_id, title: event.title, slug: event.slug, description: event.description, content: event.content, starts_at: event.starts_at, ends_at: event.ends_at, priority: event.priority, sort_order: event.sort_order, media_file_id: event.media_file_id, media_url }
  }))
  res.json({ events: visibleEvents })
}
