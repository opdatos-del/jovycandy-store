import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { JOVY_CONTENT_MODULE } from "@jovy/modules/jovy-content"

type DeleteEditorialPageWorkflowInput = {
  id: string
  slug: string
  status: string
  actor_id: string | null
}

const deleteEditorialPageStep = createStep(
  "delete-editorial-page",
  async (input: DeleteEditorialPageWorkflowInput, { container }) => {
    const contentService = container.resolve(JOVY_CONTENT_MODULE)

    await contentService.createAuditLogs({
      actor_id: input.actor_id,
      entity_type: "editorial_page",
      entity_id: input.id,
      action: "delete",
      metadata: { slug: input.slug, status: input.status },
    })
    await contentService.deleteEditorialPages(input.id)

    return new StepResponse({ id: input.id })
  },
)

export const deleteEditorialPageWorkflow = createWorkflow(
  "delete-editorial-page",
  (input: DeleteEditorialPageWorkflowInput) => {
    return new WorkflowResponse(deleteEditorialPageStep(input))
  },
)
