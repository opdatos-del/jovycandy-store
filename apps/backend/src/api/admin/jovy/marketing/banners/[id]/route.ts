import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { bannerInputSchema, updateBannerInputSchema } from "@jovy/lib/jovy/marketing"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import { deleteBannerWorkflow, saveBannerWorkflow } from "@jovy/workflows/jovy-marketing/banner"

async function getBanner(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const [banner] = await service.listMarketingBanners({ id: req.params.id })
  if (!banner) {
    res.status(404).json({ message: "Banner no encontrado" })
    return null
  }
  return banner
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const banner = await getBanner(req, res)
  if (banner) res.json({ banner })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const patch = updateBannerInputSchema.safeParse(req.body)
  if (!patch.success) return res.status(400).json({ message: "El banner no es válido", errors: patch.error.flatten() })
  const current = await getBanner(req, res)
  if (!current) return
  const input = bannerInputSchema.safeParse({ ...current, ...patch.data, starts_at: patch.data.starts_at ?? current.starts_at?.toISOString() ?? null, ends_at: patch.data.ends_at ?? current.ends_at?.toISOString() ?? null })
  if (!input.success) return res.status(400).json({ message: "El banner no es válido", errors: input.error.flatten() })
  const action = input.data.status === "published" && current.status !== "published" ? "publish" : input.data.status === "archived" ? "archive" : current.status === "published" && input.data.status !== "published" ? "unpublish" : "update"
  const { result: banner } = await saveBannerWorkflow(req.scope).run({ input: { ...input.data, id: current.id, actor_id: getAdminActorId(req), action } })
  res.json({ banner })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const current = await getBanner(req, res)
  if (!current) return
  await deleteBannerWorkflow(req.scope).run({ input: { id: current.id, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
