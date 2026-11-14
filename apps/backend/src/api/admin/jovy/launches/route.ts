import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { compareLaunchOrder, launchInputSchema } from "@jovy/lib/jovy/launches"
import { resolveFileUrl } from "@jovy/lib/jovy/media"
import { JOVY_LAUNCHES_MODULE } from "@jovy/modules/jovy-launches"
import { saveLaunchWorkflow } from "@jovy/workflows/jovy-launches/launch"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_LAUNCHES_MODULE)
  const files = req.scope.resolve(Modules.FILE)
  const launches = (await service.listLaunches({}, { order: { sort_order: "ASC", created_at: "ASC" } }))
    .sort(compareLaunchOrder)

  res.json({
    launches: await Promise.all(launches.map(async (launch) => ({
      ...launch,
      image_resolved_url: (await resolveFileUrl(files, launch.image_file_id)) ?? launch.image_url,
    }))),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = launchInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El lanzamiento no es válido", errors: parsed.error.flatten() })

  const { result: launch } = await saveLaunchWorkflow(req.scope).run({ input: parsed.data })
  res.status(201).json({ launch })
}
