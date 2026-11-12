import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"

type ReorderInput = { entity: "hero_item" | "marketing_banner"; ids: string[]; actor_id: string | null }

const reorderStep = createStep("reorder", async (input: ReorderInput, { container }) => {
  const service = container.resolve(JOVY_MARKETING_MODULE)
  const records = input.entity === "hero_item"
    ? await service.listHeroItems({ id: input.ids })
    : await service.listMarketingBanners({ id: input.ids })
  if (records.length !== input.ids.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se pueden reordenar registros inexistentes")

  await Promise.all(input.ids.map((id, sort_order) => input.entity === "hero_item"
    ? service.updateHeroItems({ id, sort_order })
    : service.updateMarketingBanners({ id, sort_order })))
  await service.createMarketingAuditLogs({ actor_id: input.actor_id, entity_type: input.entity, entity_id: input.ids.join(","), action: "reorder", metadata: { ids: input.ids } })
  return new StepResponse({ ids: input.ids })
})

export const reorderMarketingWorkflow = createWorkflow("reorder-marketing", (input: ReorderInput) => new WorkflowResponse(reorderStep(input)))
