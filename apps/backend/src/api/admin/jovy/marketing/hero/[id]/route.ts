import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { heroInputSchema, updateHeroInputSchema } from "@jovy/lib/jovy/marketing"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import { deleteHeroWorkflow, saveHeroWorkflow } from "@jovy/workflows/jovy-marketing/hero"

async function getHero(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const [hero] = await service.listHeroItems({ id: req.params.id })
  if (!hero) {
    res.status(404).json({ message: "Elemento Hero no encontrado" })
    return null
  }
  return hero
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const hero_item = await getHero(req, res)
  if (hero_item) res.json({ hero_item })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const patch = updateHeroInputSchema.safeParse(req.body)
  if (!patch.success) return res.status(400).json({ message: "El Hero no es válido", errors: patch.error.flatten() })
  const current = await getHero(req, res)
  if (!current) return
  const input = heroInputSchema.safeParse({ ...current, ...patch.data, starts_at: patch.data.starts_at ?? current.starts_at?.toISOString() ?? null, ends_at: patch.data.ends_at ?? current.ends_at?.toISOString() ?? null })
  if (!input.success) return res.status(400).json({ message: "El Hero no es válido", errors: input.error.flatten() })
  const action = input.data.status === "published" && current.status !== "published" ? "publish" : input.data.status === "archived" ? "archive" : current.status === "published" && input.data.status !== "published" ? "unpublish" : "update"
  const { result: hero_item } = await saveHeroWorkflow(req.scope).run({ input: { ...input.data, id: current.id, actor_id: getAdminActorId(req), action } })
  res.json({ hero_item })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const current = await getHero(req, res)
  if (!current) return
  await deleteHeroWorkflow(req.scope).run({ input: { id: current.id, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
