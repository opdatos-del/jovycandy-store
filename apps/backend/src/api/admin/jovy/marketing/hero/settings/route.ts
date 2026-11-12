import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { heroSettingsSchema } from "@jovy/lib/jovy/marketing"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import { saveHeroSettingsWorkflow } from "@jovy/workflows/jovy-marketing/hero-settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const [hero_settings] = await service.listHeroSettings({}, { take: 1 })
  res.json({ hero_settings: hero_settings ?? { background_color: "#00AFAA" } })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = heroSettingsSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "La configuración Hero no es válida", errors: parsed.error.flatten() })
  const { result: hero_settings } = await saveHeroSettingsWorkflow(req.scope).run({
    input: { ...parsed.data, actor_id: getAdminActorId(req) },
  })
  res.json({ hero_settings })
}
