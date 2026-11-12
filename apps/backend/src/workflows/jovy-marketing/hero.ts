import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"

import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import type { HeroInput } from "@jovy/lib/jovy/marketing"

type MutationInput = HeroInput & { id?: string; actor_id: string | null; action: "create" | "update" | "publish" | "unpublish" | "archive" }

const saveHeroStep = createStep("save-hero", async (input: MutationInput, { container }) => {
  const service = container.resolve(JOVY_MARKETING_MODULE)
  const { actor_id, action, product_id: _productId, id, starts_at, ends_at, ...data } = input
  const published_at = data.status === "published" ? new Date() : null
  const heroData = {
    ...data,
    starts_at: starts_at ? new Date(starts_at) : null,
    ends_at: ends_at ? new Date(ends_at) : null,
    published_at,
  }
  const hero = id
    ? await service.updateHeroItems({ ...heroData, id })
    : await service.createHeroItems(heroData)

  // Product associations are handled exclusively by setHeroProductWorkflow.
  // Keeping them outside this workflow prevents duplicate links when an Admin
  // saves the Hero and then confirms the selected Product.

  await service.createMarketingAuditLogs({
    actor_id: input.actor_id,
    entity_type: "hero_item",
    entity_id: hero.id,
    action: input.action,
    metadata: { status: hero.status, sort_order: hero.sort_order },
  })
  return new StepResponse(hero, hero.id)
})

export const saveHeroWorkflow = createWorkflow("save-hero", (input: MutationInput) => new WorkflowResponse(saveHeroStep(input)))

const deleteHeroStep = createStep("delete-hero", async (input: { id: string; actor_id: string | null }, { container }) => {
  const service = container.resolve(JOVY_MARKETING_MODULE)
  await service.createMarketingAuditLogs({ actor_id: input.actor_id, entity_type: "hero_item", entity_id: input.id, action: "delete" })
  await service.deleteHeroItems(input.id)
  return new StepResponse({ id: input.id })
})

export const deleteHeroWorkflow = createWorkflow("delete-hero", (input: { id: string; actor_id: string | null }) => new WorkflowResponse(deleteHeroStep(input)))
