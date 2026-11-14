import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { catalogueReorderSchema } from "@jovy/lib/jovy/catalogue"
import { reorderCatalogueCategoriesWorkflow } from "@jovy/workflows/jovy-catalogue/category"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = catalogueReorderSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "El orden de categorías no es válido", errors: parsed.error.flatten() })
  }

  const { result } = await reorderCatalogueCategoriesWorkflow(req.scope).run({ input: parsed.data })
  res.json(result)
}
