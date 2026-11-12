import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { setHeroProductWorkflow } from "@jovy/workflows/jovy-marketing/set-hero-product"

const inputSchema = z.object({ product_id: z.string().trim().min(1).nullable() })

async function getHeroProduct(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "jovy_hero_item",
    fields: ["id", "product.id", "product.title", "product.thumbnail"],
    filters: { id: req.params.id },
  })
  return data[0] as { id: string; product?: { id: string; title: string; thumbnail: string | null } | null } | undefined
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const hero = await getHeroProduct(req)
  if (!hero) return res.status(404).json({ message: "Elemento Hero no encontrado" })
  res.json({ product: hero.product ?? null })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = inputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El producto no es válido", errors: parsed.error.flatten() })
  const { result } = await setHeroProductWorkflow(req.scope).run({
    input: { hero_id: req.params.id, product_id: parsed.data.product_id, actor_id: getAdminActorId(req) },
  }) as { result: { product_id: string | null; changed: boolean } }
  if (!result.changed) {
    const current = await getHeroProduct(req)
    return res.json({ product: current?.product ?? null, changed: false })
  }
  const updated = await getHeroProduct(req)
  res.json({ product: updated?.product ?? null, changed: true })
}
