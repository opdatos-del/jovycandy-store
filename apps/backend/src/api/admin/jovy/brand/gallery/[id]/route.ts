import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { galleryInputSchema, updateGalleryInputSchema } from "@jovy/lib/jovy/brand"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { deleteBrandWorkflow, saveGalleryWorkflow } from "@jovy/workflows/jovy-brand/brand"

async function current(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_BRAND_MODULE)
  const [item] = await service.listJovyGalleryItems({ id: req.params.id })
  if (!item) {
    res.status(404).json({ message: "Elemento no encontrado" })
    return null
  }
  return item
}

async function responseItem(req: MedusaRequest, item: Record<string, unknown>) {
  try {
    const files = req.scope.resolve(Modules.FILE)
    return { ...item, media_url: (await files.retrieveFile(item.media_file_id as string)).url }
  } catch {
    return { ...item, media_url: null }
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const item = await current(req, res)
  if (item) res.json({ item: await responseItem(req, item) })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const patch = updateGalleryInputSchema.safeParse(req.body)
  if (!patch.success) return res.status(400).json({ message: "La galería no es válida", errors: patch.error.flatten() })
  const item = await current(req, res)
  if (!item) return
  const input = galleryInputSchema.safeParse({
    title: patch.data.title !== undefined ? patch.data.title : item.title,
    description: patch.data.description !== undefined ? patch.data.description : item.description,
    media_file_id: patch.data.media_file_id ?? item.media_file_id,
    status: patch.data.status ?? item.status,
    enabled: patch.data.enabled ?? item.enabled,
    sort_order: patch.data.sort_order ?? item.sort_order,
    starts_at: patch.data.starts_at !== undefined ? patch.data.starts_at : item.starts_at?.toISOString() ?? null,
    ends_at: patch.data.ends_at !== undefined ? patch.data.ends_at : item.ends_at?.toISOString() ?? null,
  })
  if (!input.success) return res.status(400).json({ message: "La galería no es válida", errors: input.error.flatten() })
  const action = input.data.status === "published" && item.status !== "published"
    ? "publish"
    : input.data.status === "archived"
      ? "archive"
      : item.status === "published" && input.data.status !== "published"
        ? "unpublish"
        : "update"
  const { result } = await saveGalleryWorkflow(req.scope).run({
    input: { ...input.data, id: item.id, actor_id: getAdminActorId(req), action },
  })
  res.json({ item: await responseItem(req, result) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const item = await current(req, res)
  if (!item) return
  await deleteBrandWorkflow(req.scope).run({ input: { entity: "gallery", id: item.id, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
