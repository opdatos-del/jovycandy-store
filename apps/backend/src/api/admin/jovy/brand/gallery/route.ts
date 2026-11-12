import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { galleryInputSchema } from "@jovy/lib/jovy/brand"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { saveGalleryWorkflow } from "@jovy/workflows/jovy-brand/brand"

async function withMediaUrl(fileModule: { retrieveFile: (id: string) => Promise<{ url: string }> }, item: Record<string, unknown>) {
  try {
    return { ...item, media_url: (await fileModule.retrieveFile(item.media_file_id as string)).url }
  } catch {
    return { ...item, media_url: null }
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_BRAND_MODULE)
  const fileModule = req.scope.resolve(Modules.FILE)
  const items = await service.listJovyGalleryItems({}, { order: { sort_order: "ASC", created_at: "ASC" } })
  res.json({ items: await Promise.all(items.map((item) => withMediaUrl(fileModule, item))) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = galleryInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "La galería no es válida", errors: parsed.error.flatten() })
  const { result: item } = await saveGalleryWorkflow(req.scope).run({
    input: {
      ...parsed.data,
      actor_id: getAdminActorId(req),
      action: parsed.data.status === "published" ? "publish" : "create",
    },
  })
  res.status(201).json({ item })
}
