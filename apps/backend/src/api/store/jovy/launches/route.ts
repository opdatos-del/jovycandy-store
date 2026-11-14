import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { LAUNCH_DEFAULT_BACKGROUND_COLOR, compareLaunchOrder, isLaunchVisible } from "@jovy/lib/jovy/launches"
import { resolveFileUrl } from "@jovy/lib/jovy/media"
import { JOVY_LAUNCHES_MODULE } from "@jovy/modules/jovy-launches"

/**
 * Sección "Nuevos lanzamientos": independiente del Hero y sin estado editorial
 * ni ventana. Solo `active = true` se publica. El producto se referencia por id;
 * el storefront lo resuelve contra `/store/products`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_LAUNCHES_MODULE)
  const files = req.scope.resolve(Modules.FILE)
  const [settings] = await service.listLaunchSettings({}, { take: 1 })
  const launches = (await service.listLaunches({}, { order: { sort_order: "ASC", created_at: "ASC" } }))
    .filter(isLaunchVisible)
    .sort(compareLaunchOrder)

  res.json({
    settings: { background_color: settings?.background_color ?? LAUNCH_DEFAULT_BACKGROUND_COLOR },
    launches: await Promise.all(launches.map(async (launch) => ({
      id: launch.id,
      product_id: launch.product_id,
      title: launch.title,
      description: launch.description,
      image_file_id: launch.image_file_id,
      image_url: (await resolveFileUrl(files, launch.image_file_id)) ?? launch.image_url,
      sort_order: launch.sort_order,
    }))),
  })
}
