import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { eventPublishIssues } from "@jovy/lib/jovy/events"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"

type EventData = {
  id?: string
  event_type_id?: string | null
  title: string
  title_en?: string | null
  slug: string
  description?: string | null
  content?: string | null
  media_file_id?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status: "draft" | "published" | "archived" | "cancelled"
  enabled: boolean
  priority: number
  sort_order: number
  actor_id: string | null
  action: "create" | "update" | "publish" | "unpublish" | "archive"
}

const saveEventStep = createStep("save-event", async (input: EventData, { container }) => {
  const service = container.resolve(JOVY_EVENTS_MODULE)
  const { id, actor_id, action, starts_at, ends_at, event_type_id, ...data } = input

  if (event_type_id) {
    const [eventType] = await service.listJovyEventTypes({ id: event_type_id })
    if (!eventType) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tipo de evento no encontrado")
  }

  if (data.status === "published") {
    const issues = eventPublishIssues({ ...data, event_type_id, starts_at, ends_at })
    if (issues.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `No se puede publicar el evento. Falta: ${issues.join(", ")}`)
    }
  }

  const eventData = {
    ...data,
    event_type_id: event_type_id ?? null,
    starts_at: starts_at ? new Date(starts_at) : null,
    ends_at: ends_at ? new Date(ends_at) : null,
    published_at: data.status === "published" ? new Date() : null,
  }
  const event = id ? await service.updateJovyEvents({ id, ...eventData }) : await service.createJovyEvents(eventData)
  await service.createJovyEventAuditLogs({ actor_id, entity_id: event.id, action, metadata: { slug: event.slug, status: event.status, priority: event.priority, sort_order: event.sort_order } })
  return new StepResponse(event, event.id)
})

export const saveEventWorkflow = createWorkflow("save-event", (input: EventData) => new WorkflowResponse(saveEventStep(input)))

const deleteEventStep = createStep("delete-event", async (input: { id: string; actor_id: string | null }, { container }) => {
  const service = container.resolve(JOVY_EVENTS_MODULE)
  await service.createJovyEventAuditLogs({ actor_id: input.actor_id, entity_id: input.id, action: "delete" })
  await service.deleteJovyEvents(input.id)
  return new StepResponse({ id: input.id })
})

export const deleteEventWorkflow = createWorkflow("delete-event", (input: { id: string; actor_id: string | null }) => new WorkflowResponse(deleteEventStep(input)))

const reorderEventsStep = createStep("reorder-events", async (input: { ids: string[]; actor_id: string | null }, { container }) => {
  const service = container.resolve(JOVY_EVENTS_MODULE)
  const events = await service.listJovyEvents({ id: input.ids })
  if (events.length !== input.ids.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se pueden reordenar eventos inexistentes")
  await Promise.all(input.ids.map((id, sort_order) => service.updateJovyEvents({ id, sort_order })))
  await service.createJovyEventAuditLogs({ actor_id: input.actor_id, entity_id: input.ids.join(","), action: "reorder", metadata: { ids: input.ids } })
  return new StepResponse({ ids: input.ids })
})

export const reorderEventsWorkflow = createWorkflow("reorder-events", (input: { ids: string[]; actor_id: string | null }) => new WorkflowResponse(reorderEventsStep(input)))
