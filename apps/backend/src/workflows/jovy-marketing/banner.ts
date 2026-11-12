import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import type { BannerInput } from "@jovy/lib/jovy/marketing"

type MutationInput = BannerInput & { id?: string; actor_id: string | null; action: "create" | "update" | "publish" | "unpublish" | "archive" }

const saveBannerStep = createStep("save-banner", async (input: MutationInput, { container }) => {
  const service = container.resolve(JOVY_MARKETING_MODULE)
  const { actor_id, action, id, starts_at, ends_at, ...data } = input
  const published_at = data.status === "published" ? new Date() : null
  const bannerData = {
    ...data,
    starts_at: starts_at ? new Date(starts_at) : null,
    ends_at: ends_at ? new Date(ends_at) : null,
    published_at,
  }
  const banner = id
    ? await service.updateMarketingBanners({ ...bannerData, id })
    : await service.createMarketingBanners(bannerData)

  await service.createMarketingAuditLogs({
    actor_id: input.actor_id,
    entity_type: "marketing_banner",
    entity_id: banner.id,
    action: input.action,
    metadata: { slot: banner.slot, status: banner.status, priority: banner.priority, sort_order: banner.sort_order },
  })
  return new StepResponse(banner, banner.id)
})

export const saveBannerWorkflow = createWorkflow("save-banner", (input: MutationInput) => new WorkflowResponse(saveBannerStep(input)))

const deleteBannerStep = createStep("delete-banner", async (input: { id: string; actor_id: string | null }, { container }) => {
  const service = container.resolve(JOVY_MARKETING_MODULE)
  await service.createMarketingAuditLogs({ actor_id: input.actor_id, entity_type: "marketing_banner", entity_id: input.id, action: "delete" })
  await service.deleteMarketingBanners(input.id)
  return new StepResponse({ id: input.id })
})

export const deleteBannerWorkflow = createWorkflow("delete-banner", (input: { id: string; actor_id: string | null }) => new WorkflowResponse(deleteBannerStep(input)))
