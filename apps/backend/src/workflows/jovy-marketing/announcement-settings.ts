import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { AnnouncementSettingsInput } from "@jovy/lib/jovy/announcements"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"

type SaveAnnouncementSettingsInput = AnnouncementSettingsInput & { actor_id: string | null }

const saveAnnouncementSettingsStep = createStep(
  "save-announcement-settings",
  async (input: SaveAnnouncementSettingsInput, { container }) => {
    const service = container.resolve(JOVY_MARKETING_MODULE)
    const [current] = await service.listAnnouncementSettings({}, { take: 1 })
    const data = {
      corporate_message_es: input.corporate_message_es,
      corporate_message_en: input.corporate_message_en,
      updated_by: input.actor_id,
    }
    const announcement_settings = current
      ? await service.updateAnnouncementSettings({ id: current.id, ...data })
      : await service.createAnnouncementSettings(data)
    return new StepResponse(announcement_settings)
  },
)

export const saveAnnouncementSettingsWorkflow = createWorkflow(
  "save-announcement-settings",
  (input: SaveAnnouncementSettingsInput) => new WorkflowResponse(saveAnnouncementSettingsStep(input)),
)
