import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MAX_VISIBLE_GALLERY_ITEMS, isPublicBrandItem } from "@jovy/lib/jovy/brand"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"

/**
 * The write path enforces the four-item limit under a PostgreSQL advisory lock.
 * This read cap keeps the Store contract even if legacy or out-of-band rows
 * bypass it; only counts are logged, never titles or media identifiers.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_BRAND_MODULE)
  const files = req.scope.resolve(Modules.FILE)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const items = (await service.listJovyGalleryItems({}, { order: { sort_order: "ASC", created_at: "ASC" } }))
    .filter((item) => isPublicBrandItem(item))

  if (items.length > MAX_VISIBLE_GALLERY_ITEMS) {
    logger.warn(
      `[jovy-brand] ${items.length} elementos de galería publicados; se devuelven ${MAX_VISIBLE_GALLERY_ITEMS}`,
    )
  }

  const visible = items.slice(0, MAX_VISIBLE_GALLERY_ITEMS)
  res.json({
    items: await Promise.all(visible.map(async (item) => {
      let media_url: null | string = null
      try {
        media_url = (await files.retrieveFile(item.media_file_id)).url
      } catch {
        // A missing local asset degrades to null instead of exposing storage errors.
      }
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        sort_order: item.sort_order,
        media_url,
      }
    })),
  })
}
