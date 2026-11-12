import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { logoInputSchema } from "@jovy/lib/jovy/brand"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { saveLogoWorkflow } from "@jovy/workflows/jovy-brand/brand"

async function withMediaUrl(fileModule: { retrieveFile: (id: string) => Promise<{ url: string }> }, logo: Record<string, unknown>) {
  try {
    return { ...logo, media_url: (await fileModule.retrieveFile(logo.media_file_id as string)).url }
  } catch {
    return { ...logo, media_url: null }
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_BRAND_MODULE)
  const fileModule = req.scope.resolve(Modules.FILE)
  const logos = await service.listLogos({}, { order: { sort_order: "ASC", created_at: "ASC" } })
  res.json({ logos: await Promise.all(logos.map((logo) => withMediaUrl(fileModule, logo))) })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = logoInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El logo no es válido", errors: parsed.error.flatten() })
  const { result: logo } = await saveLogoWorkflow(req.scope).run({
    input: { ...parsed.data, actor_id: getAdminActorId(req), action: "create" },
  })
  res.status(201).json({ logo })
}
