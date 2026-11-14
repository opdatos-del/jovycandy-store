import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { launchInputSchema, updateLaunchInputSchema } from "@jovy/lib/jovy/launches"
import { JOVY_LAUNCHES_MODULE } from "@jovy/modules/jovy-launches"
import { deleteLaunchWorkflow, saveLaunchWorkflow } from "@jovy/workflows/jovy-launches/launch"

async function getLaunch(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_LAUNCHES_MODULE)
  const [launch] = await service.listLaunches({ id: req.params.id })
  if (!launch) {
    res.status(404).json({ message: "Lanzamiento no encontrado" })
    return null
  }
  return launch
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const launch = await getLaunch(req, res)
  if (launch) res.json({ launch })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const patch = updateLaunchInputSchema.safeParse(req.body)
  if (!patch.success) return res.status(400).json({ message: "El lanzamiento no es válido", errors: patch.error.flatten() })

  const current = await getLaunch(req, res)
  if (!current) return

  const input = launchInputSchema.safeParse({ ...current, ...patch.data })
  if (!input.success) return res.status(400).json({ message: "El lanzamiento no es válido", errors: input.error.flatten() })

  const { result: launch } = await saveLaunchWorkflow(req.scope).run({
    input: { id: current.id, ...input.data },
  })
  res.json({ launch })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const current = await getLaunch(req, res)
  if (!current) return
  await deleteLaunchWorkflow(req.scope).run({ input: { id: current.id } })
  res.status(204).send()
}
