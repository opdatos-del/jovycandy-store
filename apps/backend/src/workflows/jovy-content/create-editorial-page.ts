import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { JOVY_CONTENT_MODULE } from "@jovy/modules/jovy-content"
import type { CreateEditorialPageInput } from "@jovy/lib/jovy/editorial-page"
import type { EditorialAuditAction } from "@jovy/lib/jovy/audit"

type CreateEditorialPageWorkflowInput = Omit<CreateEditorialPageInput, "published_at"> & {
  published_at: Date | null
  actor_id: string | null
  audit_action: Extract<EditorialAuditAction, "create">
}

const createEditorialPageStep = createStep(
  "create-editorial-page",
  async (input: CreateEditorialPageWorkflowInput, { container }) => {
    const contentService = container.resolve(JOVY_CONTENT_MODULE)
    const page = await contentService.createEditorialPages({
      slug: input.slug,
      status: input.status,
      translations: input.translations,
      seo: input.seo,
      published_at: input.published_at,
    })

    await contentService.createAuditLogs({
      actor_id: input.actor_id,
      entity_type: "editorial_page",
      entity_id: page.id,
      action: input.audit_action,
      metadata: { slug: page.slug, status: page.status },
    })

    return new StepResponse(page, page.id)
  },
)

export const createEditorialPageWorkflow = createWorkflow(
  "create-editorial-page",
  (input: CreateEditorialPageWorkflowInput) => {
    return new WorkflowResponse(createEditorialPageStep(input))
  },
)
