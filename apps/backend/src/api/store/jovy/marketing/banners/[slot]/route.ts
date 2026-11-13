import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { bannerSlotSchema, compareBannerOrder, isMarketingVisible } from "@jovy/lib/jovy/marketing"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const slot = bannerSlotSchema.safeParse(req.params.slot)
  if (!slot.success) return res.status(404).json({ message: "Slot no encontrado" })

  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const fileModule = req.scope.resolve(Modules.FILE)
  const visibleBanners = (await service.listMarketingBanners({ slot: slot.data }, { order: { priority: "DESC", sort_order: "ASC", created_at: "ASC" } }))
    .filter((banner) => isMarketingVisible(banner))
    .sort(compareBannerOrder)
  const banners = await Promise.all(visibleBanners.map(async ({ id, translations, media_file_id, cta_url, auto_open, frequency, priority, sort_order }) => {
    let media_url: string | null = null
    if (media_file_id) {
      try {
        media_url = (await fileModule.retrieveFile(media_file_id)).url
      } catch {
        // A missing local asset is represented as null without exposing an
        // internal storage failure through the public marketing API.
      }
    }
    return { id, translations, media_file_id, media_url, cta_url, auto_open, frequency, priority, sort_order }
  }))
  res.json({ banners })
}
