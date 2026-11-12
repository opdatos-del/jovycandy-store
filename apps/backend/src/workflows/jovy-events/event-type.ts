import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { JOVY_EVENTS_MODULE } from "@jovy/modules/jovy-events"

type CreateEventTypeInput = { code: string; name: string; description?: string | null; actor_id: string | null }

const createEventTypeStep = createStep("create-event-type", async (input: CreateEventTypeInput, { container }) => {
  const service = container.resolve(JOVY_EVENTS_MODULE)
  const eventType = await service.createJovyEventTypes({ code: input.code, name: input.name, description: input.description ?? null })
  return new StepResponse(eventType, eventType.id)
})

export const createEventTypeWorkflow = createWorkflow("create-event-type", (input: CreateEventTypeInput) => new WorkflowResponse(createEventTypeStep(input)))
