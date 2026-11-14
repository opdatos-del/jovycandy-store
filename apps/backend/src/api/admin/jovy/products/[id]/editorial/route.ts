import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { productEditorialInputSchema } from "@jovy/lib/jovy/product-editorial"
import {
  decorateEditorialRecords,
  type ProductEditorialRecord,
} from "@jovy/lib/jovy/product-editorial-graph"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"
import {
  deleteProductEditorialWorkflow,
  saveProductEditorialWorkflow,
} from "@jovy/workflows/jovy-product-editorial/editorial"

type EditorialService = {
  listProductEditorials: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<ProductEditorialRecord[]>
}

/**
 * La ficha se identifica por el id del producto comercial, no por el id del
 * registro editorial: el Admin la abre desde el detalle nativo del producto.
 * Se incluye la ficha borrada lógicamente para que la UI pueda ofrecer la
 * restauración; la bandera `deleted` lo expone sin ambigüedad.
 */
async function loadRecord(req: MedusaRequest) {
  const service = req.scope.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService
  const [record] = await service.listProductEditorials({ product_id: req.params.id }, { withDeleted: true })
  return record
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const record = await loadRecord(req)
  if (!record) return res.status(404).json({ message: "El producto no tiene ficha editorial" })

  const [editorial] = await decorateEditorialRecords(req.scope, [record])
  res.json({ editorial, deleted: Boolean(record.deleted_at) })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = productEditorialInputSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: "La ficha editorial no es válida", errors: parsed.error.flatten() })
  }

  const { result } = await saveProductEditorialWorkflow(req.scope).run({
    input: { product_id: req.params.id, ...parsed.data },
  })

  const [editorial] = await decorateEditorialRecords(req.scope, [result as ProductEditorialRecord])
  res.json({ editorial, deleted: false })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await deleteProductEditorialWorkflow(req.scope).run({ input: { product_id: req.params.id } })
  res.status(204).send()
}
