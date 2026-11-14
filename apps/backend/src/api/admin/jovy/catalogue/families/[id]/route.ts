import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { familyInputSchema, updateFamilyInputSchema } from "@jovy/lib/jovy/catalogue"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { deleteProductFamilyWorkflow, saveProductFamilyWorkflow } from "@jovy/workflows/jovy-catalogue/family"

async function getFamily(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CATALOGUE_MODULE)
  const [family] = await service.listProductFamilies({ id: req.params.id })
  if (!family) {
    res.status(404).json({ message: "Familia no encontrada" })
    return null
  }
  return family
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const family = await getFamily(req, res)
  if (family) res.json({ family })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const patch = updateFamilyInputSchema.safeParse(req.body)
  if (!patch.success) return res.status(400).json({ message: "La familia no es válida", errors: patch.error.flatten() })

  const current = await getFamily(req, res)
  if (!current) return

  const input = familyInputSchema.safeParse({ ...current, ...patch.data })
  if (!input.success) return res.status(400).json({ message: "La familia no es válida", errors: input.error.flatten() })

  const { result: family } = await saveProductFamilyWorkflow(req.scope).run({
    input: { id: current.id, ...input.data },
  })
  res.json({ family })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const current = await getFamily(req, res)
  if (!current) return
  await deleteProductFamilyWorkflow(req.scope).run({ input: { id: current.id } })
  res.status(204).send()
}
