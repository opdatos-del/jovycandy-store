import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { JOVY_LAUNCHES_MODULE } from "@jovy/modules/jovy-launches"

type SaveLaunchSettingsInput = { background_color: string }

const saveLaunchSettingsStep = createStep("save-launch-settings", async (input: SaveLaunchSettingsInput, { container }) => {
  const service = container.resolve(JOVY_LAUNCHES_MODULE)
  const [current] = await service.listLaunchSettings({}, { take: 1 })
  const launch_settings = current
    ? await service.updateLaunchSettings({ id: current.id, background_color: input.background_color })
    : await service.createLaunchSettings({ background_color: input.background_color })
  return new StepResponse(launch_settings)
})

export const saveLaunchSettingsWorkflow = createWorkflow(
  "save-launch-settings",
  (input: SaveLaunchSettingsInput) => new WorkflowResponse(saveLaunchSettingsStep(input)),
)
