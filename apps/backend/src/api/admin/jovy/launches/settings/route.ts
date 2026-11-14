import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { LAUNCH_DEFAULT_BACKGROUND_COLOR, launchSettingsSchema } from "@jovy/lib/jovy/launches"
import { JOVY_LAUNCHES_MODULE } from "@jovy/modules/jovy-launches"
import { saveLaunchSettingsWorkflow } from "@jovy/workflows/jovy-launches/settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_LAUNCHES_MODULE)
  const [launch_settings] = await service.listLaunchSettings({}, { take: 1 })
  res.json({ launch_settings: launch_settings ?? { background_color: LAUNCH_DEFAULT_BACKGROUND_COLOR } })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = launchSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "La configuración de lanzamientos no es válida", errors: parsed.error.flatten() })
  }

  const { result: launch_settings } = await saveLaunchSettingsWorkflow(req.scope).run({ input: parsed.data })
  res.json({ launch_settings })
}
