import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { heroInputSchema } from "@jovy/lib/jovy/marketing"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import { saveHeroWorkflow } from "@jovy/workflows/jovy-marketing/hero"
import { setHeroProductWorkflow } from "@jovy/workflows/jovy-marketing/set-hero-product"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const hero_items = await service.listHeroItems({}, { order: { sort_order: "ASC", created_at: "ASC" } })
  res.json({ hero_items })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = heroInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El Hero no es válido", errors: parsed.error.flatten() })

  const actor_id = getAdminActorId(req)
  const { product_id, ...heroInput } = parsed.data
  const { result: hero_item } = await saveHeroWorkflow(req.scope).run({
    input: { ...heroInput, actor_id, action: parsed.data.status === "published" ? "publish" : "create" },
  })

  if (product_id) {
    await setHeroProductWorkflow(req.scope).run({
      input: { hero_id: hero_item.id, product_id, actor_id },
    })
  }

  res.status(201).json({ hero_item })
}
