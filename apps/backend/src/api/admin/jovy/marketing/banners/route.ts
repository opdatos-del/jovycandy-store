import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { bannerInputSchema } from "@jovy/lib/jovy/marketing"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"
import { saveBannerWorkflow } from "@jovy/workflows/jovy-marketing/banner"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const banners = await service.listMarketingBanners({}, { order: { priority: "DESC", sort_order: "ASC", created_at: "ASC" } })
  res.json({ banners })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = bannerInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El banner no es válido", errors: parsed.error.flatten() })

  const { result: banner } = await saveBannerWorkflow(req.scope).run({
    input: { ...parsed.data, actor_id: getAdminActorId(req), action: parsed.data.status === "published" ? "publish" : "create" },
  })
  res.status(201).json({ banner })
}
