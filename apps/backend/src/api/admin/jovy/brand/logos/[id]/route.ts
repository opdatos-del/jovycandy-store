import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { logoInputSchema, updateLogoInputSchema } from "@jovy/lib/jovy/brand"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { deleteBrandWorkflow, saveLogoWorkflow } from "@jovy/workflows/jovy-brand/brand"

async function current(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_BRAND_MODULE)
  const [logo] = await service.listLogos({ id: req.params.id })
  if (!logo) {
    res.status(404).json({ message: "Logo no encontrado" })
    return null
  }
  return logo
}

async function responseLogo(req: MedusaRequest, logo: Record<string, unknown>) {
  try {
    const files = req.scope.resolve(Modules.FILE)
    return { ...logo, media_url: (await files.retrieveFile(logo.media_file_id as string)).url }
  } catch {
    return { ...logo, media_url: null }
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logo = await current(req, res)
  if (logo) res.json({ logo: await responseLogo(req, logo) })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const patch = updateLogoInputSchema.safeParse(req.body)
  if (!patch.success) return res.status(400).json({ message: "El logo no es válido", errors: patch.error.flatten() })
  const logo = await current(req, res)
  if (!logo) return
  const input = logoInputSchema.safeParse({
    slug: patch.data.slug ?? logo.slug,
    name: patch.data.name ?? logo.name,
    alt: patch.data.alt !== undefined ? patch.data.alt : logo.alt,
    families: patch.data.families !== undefined ? patch.data.families : logo.families,
    media_file_id: patch.data.media_file_id ?? logo.media_file_id,
    crop: patch.data.crop !== undefined ? patch.data.crop : logo.crop,
    enabled: patch.data.enabled ?? logo.enabled,
    sort_order: patch.data.sort_order ?? logo.sort_order,
  })
  if (!input.success) return res.status(400).json({ message: "El logo no es válido", errors: input.error.flatten() })
  const { result } = await saveLogoWorkflow(req.scope).run({
    input: { ...input.data, id: logo.id, actor_id: getAdminActorId(req), action: "update" },
  })
  res.json({ logo: await responseLogo(req, result) })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const logo = await current(req, res)
  if (!logo) return
  await deleteBrandWorkflow(req.scope).run({ input: { entity: "logo", id: logo.id, actor_id: getAdminActorId(req) } })
  res.status(204).send()
}
