import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_CONTENT_MODULE } from "@jovy/modules/jovy-content"
import { isPubliclyVisible } from "@jovy/lib/jovy/editorial-page"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const contentService = req.scope.resolve(JOVY_CONTENT_MODULE)
  const [page] = await contentService.listEditorialPages({ slug: req.params.slug })

  if (!page || !isPubliclyVisible(page)) {
    return res.status(404).json({ message: "Contenido no encontrado" })
  }

  res.json({
    page: {
      slug: page.slug,
      translations: page.translations,
      seo: page.seo,
      published_at: page.published_at,
      updated_at: page.updated_at,
    },
  })
}
