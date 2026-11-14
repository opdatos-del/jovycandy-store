import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { announcementSettingsSchema } from "@jovy/lib/jovy/announcements"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import { saveAnnouncementSettingsWorkflow } from "@jovy/workflows/jovy-marketing/announcement-settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const [settings] = await service.listAnnouncementSettings({}, { take: 1 })
  res.json({ announcement_settings: settings ?? { corporate_message_es: null, corporate_message_en: null } })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = announcementSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "La configuración de anuncios no es válida", errors: parsed.error.flatten() })
  }

  const { result: announcement_settings } = await saveAnnouncementSettingsWorkflow(req.scope).run({
    input: { ...parsed.data, actor_id: getAdminActorId(req) },
  })
  res.json({ announcement_settings })
}
