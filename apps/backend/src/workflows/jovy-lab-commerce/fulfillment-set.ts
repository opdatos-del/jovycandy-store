import { createFulfillmentSets } from "@medusajs/medusa/core-flows"
import type { CreateFulfillmentSetDTO } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

/**
 * Crea el fulfillment set de laboratorio mediante un workflow compensable.
 * El paso nativo conserva la creación anidada de service zones y geo zones.
 */
export const createJovyLabFulfillmentSetWorkflow = createWorkflow(
  "create-jovy-lab-fulfillment-set",
  function (input: CreateFulfillmentSetDTO) {
    const fulfillmentSets = createFulfillmentSets([input])
    return new WorkflowResponse(fulfillmentSets)
  },
)

const markLabFulfillmentSetStep = createStep(
  "mark-lab-fulfillment-set",
  async (
    input: { id: string; metadata: Record<string, unknown> },
    { container },
  ) => {
    const fulfillment = container.resolve(Modules.FULFILLMENT) as unknown as {
      updateFulfillmentSets: (data: Record<string, unknown>) => Promise<unknown>
    }
    await fulfillment.updateFulfillmentSets(input)
    return new StepResponse({ id: input.id })
  },
)

/** Añade identidad estable a un fulfillment set creado o heredado por nombre. */
export const markJovyLabFulfillmentSetWorkflow = createWorkflow(
  "mark-jovy-lab-fulfillment-set",
  function (input: { id: string; metadata: Record<string, unknown> }) {
    return new WorkflowResponse(markLabFulfillmentSetStep(input))
  },
)
