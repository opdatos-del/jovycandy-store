import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { launchReorderSchema } from "@jovy/lib/jovy/launches"
import { reorderLaunchesWorkflow } from "@jovy/workflows/jovy-launches/launch"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = launchReorderSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "El orden de lanzamientos no es válido", errors: parsed.error.flatten() })
  }

  const { result } = await reorderLaunchesWorkflow(req.scope).run({ input: parsed.data })
  res.json(result)
}
