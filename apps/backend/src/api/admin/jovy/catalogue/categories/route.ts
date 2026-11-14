import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { compareCatalogueOrder, normalizeCatalogueInteraction } from "@jovy/lib/jovy/catalogue"
import { resolveFileUrl } from "@jovy/lib/jovy/media"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CATALOGUE_MODULE)
  const files = req.scope.resolve(Modules.FILE)
  const categories = (await service.listCatalogueCategories({}, { order: { sort_order: "ASC", created_at: "ASC" } }))
    .sort(compareCatalogueOrder)

  res.json({
    categories: await Promise.all(categories.map(async (category) => ({
      ...category,
      ...normalizeCatalogueInteraction(category),
      // La URL efectiva prefiere el archivo gestionado y cae a la URL externa
      // guardada; la respuesta conserva ambos valores para edición.
      image_resolved_url: (await resolveFileUrl(files, category.image_file_id)) ?? category.image_url,
    }))),
  })
}
