import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { catalogueReorderSchema } from "@jovy/lib/jovy/catalogue"
import { reorderProductFamiliesWorkflow } from "@jovy/workflows/jovy-catalogue/family"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = catalogueReorderSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "El orden de familias no es válido", errors: parsed.error.flatten() })
  }

  const { result } = await reorderProductFamiliesWorkflow(req.scope).run({ input: parsed.data })
  res.json(result)
}
