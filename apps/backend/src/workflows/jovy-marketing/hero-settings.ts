import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"

type SaveHeroSettingsInput = { background_color: string; actor_id: string | null }

const saveHeroSettingsStep = createStep("save-hero-settings", async (input: SaveHeroSettingsInput, { container }) => {
  const service = container.resolve(JOVY_MARKETING_MODULE)
  const [current] = await service.listHeroSettings({}, { take: 1 })
  const hero_settings = current
    ? await service.updateHeroSettings({ id: current.id, background_color: input.background_color })
    : await service.createHeroSettings({ background_color: input.background_color })
  await service.createMarketingAuditLogs({ actor_id: input.actor_id, entity_type: "hero_settings", entity_id: hero_settings.id, action: "update", metadata: { background_color: input.background_color } })
  return new StepResponse(hero_settings, hero_settings.id)
})

export const saveHeroSettingsWorkflow = createWorkflow("save-hero-settings", (input: SaveHeroSettingsInput) => new WorkflowResponse(saveHeroSettingsStep(input)))
