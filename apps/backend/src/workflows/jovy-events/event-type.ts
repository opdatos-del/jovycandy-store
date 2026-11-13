import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"

type CreateEventTypeInput = { code: string; name: string; description?: string | null; actor_id: string | null }
type UpdateEventTypeInput = { id: string; code?: string; name?: string; description?: string | null; actor_id: string | null }

const createEventTypeStep = createStep("create-event-type", async (input: CreateEventTypeInput, { container }) => {
  const service = container.resolve(JOVY_EVENTS_MODULE)
  const [existing] = await service.listJovyEventTypes({ code: input.code })
  if (existing) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Ya existe un tipo de evento con ese código")

  const eventType = await service.createJovyEventTypes({ code: input.code, name: input.name, description: input.description ?? null })
  await service.createJovyEventAuditLogs({ actor_id: input.actor_id, entity_id: eventType.id, action: "create", metadata: { code: eventType.code, name: eventType.name } })
  return new StepResponse(eventType, eventType.id)
})

export const createEventTypeWorkflow = createWorkflow("create-event-type", (input: CreateEventTypeInput) => new WorkflowResponse(createEventTypeStep(input)))

const updateEventTypeStep = createStep("update-event-type", async (input: UpdateEventTypeInput, { container }) => {
  const service = container.resolve(JOVY_EVENTS_MODULE)
  const [current] = await service.listJovyEventTypes({ id: input.id })
  if (!current) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tipo de evento no encontrado")

  if (input.code && input.code !== current.code) {
    const [duplicate] = await service.listJovyEventTypes({ code: input.code })
    if (duplicate && duplicate.id !== current.id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Ya existe un tipo de evento con ese código")
  }

  const eventType = await service.updateJovyEventTypes({
    id: current.id,
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
  })
  await service.createJovyEventAuditLogs({ actor_id: input.actor_id, entity_id: eventType.id, action: "update", metadata: { code: eventType.code, name: eventType.name } })
  return new StepResponse(eventType)
})

export const updateEventTypeWorkflow = createWorkflow("update-event-type", (input: UpdateEventTypeInput) => new WorkflowResponse(updateEventTypeStep(input)))

const deleteEventTypeStep = createStep("delete-event-type", async (input: { id: string; actor_id: string | null }, { container }) => {
  const service = container.resolve(JOVY_EVENTS_MODULE)
  const [current] = await service.listJovyEventTypes({ id: input.id })
  if (!current) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Tipo de evento no encontrado")

  const events = await service.listJovyEvents({ event_type_id: current.id })
  if (events.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `No se puede eliminar el tipo de evento porque está en uso por ${events.length} evento(s). Reasigna esos eventos antes de continuar`,
    )
  }

  await service.createJovyEventAuditLogs({ actor_id: input.actor_id, entity_id: current.id, action: "delete", metadata: { code: current.code, name: current.name } })
  await service.deleteJovyEventTypes(current.id)
  return new StepResponse({ id: current.id })
})

export const deleteEventTypeWorkflow = createWorkflow("delete-event-type", (input: { id: string; actor_id: string | null }) => new WorkflowResponse(deleteEventTypeStep(input)))
