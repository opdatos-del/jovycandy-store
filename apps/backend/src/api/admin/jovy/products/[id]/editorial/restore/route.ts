import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  decorateEditorialRecords,
  type ProductEditorialRecord,
} from "@jovy/lib/jovy/product-editorial-graph"
import { restoreProductEditorialWorkflow } from "@jovy/workflows/jovy-product-editorial/editorial"

/**
 * Restaura únicamente la ficha editorial (`deleted_at` propio). No resucita ni
 * modifica el producto comercial: si el producto ya no existe, responde 404 y
 * la ficha queda como estaba.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await restoreProductEditorialWorkflow(req.scope).run({
    input: { product_id: req.params.id },
  })

  const [editorial] = await decorateEditorialRecords(req.scope, [result as ProductEditorialRecord])
  res.json({ editorial, deleted: false })
}
