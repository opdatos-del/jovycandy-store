import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { compareHeroOrder, isMarketingVisible } from "@jovy/lib/jovy/marketing"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_MARKETING_MODULE)
  const fileModule = req.scope.resolve(Modules.FILE)
  const visibleItems = (await service.listHeroItems({}, { order: { sort_order: "ASC", created_at: "ASC" } }))
    .filter((item) => isMarketingVisible(item))
    .sort(compareHeroOrder)

  const hero_items = await Promise.all(visibleItems.map(async ({ id, translations, background_color, media_file_id, cta_url, sort_order }) => {
    let media_url: string | null = null
    if (media_file_id) {
      try {
        media_url = (await fileModule.retrieveFile(media_file_id)).url
      } catch {
        // Local laboratory media can be removed independently. A missing file
        // must not make a published Hero or the Store API unavailable.
      }
    }
    return { id, translations, background_color, media_file_id, media_url, cta_url, sort_order }
  }))
  res.json({ hero_items })
}
