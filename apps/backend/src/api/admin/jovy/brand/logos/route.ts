import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { logoInputSchema } from "@jovy/lib/jovy/brand"
import {
  loadBrandFamilyDirectory,
  resolveLogoFamilySelection,
  resolveStoredLogoFamilies,
} from "@jovy/lib/jovy/brand-family"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { saveLogoWorkflow } from "@jovy/workflows/jovy-brand/brand"

async function withMediaUrl(fileModule: { retrieveFile: (id: string) => Promise<{ url: string }> }, logo: Record<string, unknown>) {
  try {
    return { ...logo, media_url: (await fileModule.retrieveFile(logo.media_file_id as string)).url }
  } catch {
    return { ...logo, media_url: null }
  }
}

/**
 * Los logos devuelven la relación real (`family_ids`, `family_labels`) y, en
 * paralelo, el array legado con los slugs que todavía no tienen familia
 * canónica (`unmapped_families`). El Admin usa la relación como selección y el
 * legado solo como advertencia.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_BRAND_MODULE)
  const fileModule = req.scope.resolve(Modules.FILE)
  const logos = await service.listLogos({}, { order: { sort_order: "ASC", created_at: "ASC" } })
  const [directory, relations] = await Promise.all([
    loadBrandFamilyDirectory(req.scope),
    logos.length ? service.listLogoFamilies({ logo_id: logos.map((logo) => logo.id) }) : Promise.resolve([]),
  ])
  const familyIdsByLogo = new Map<string, string[]>()
  for (const relation of relations) {
    familyIdsByLogo.set(relation.logo_id, [...(familyIdsByLogo.get(relation.logo_id) ?? []), relation.family_id])
  }

  res.json({
    logos: await Promise.all(logos.map(async (logo) => ({
      ...await withMediaUrl(fileModule, logo),
      ...resolveLogoFamilySelection({
        families_linked: logo.families_linked,
        families: logo.families,
        family_ids: familyIdsByLogo.get(logo.id),
        directory,
      }),
    }))),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = logoInputSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "El logo no es válido", errors: parsed.error.flatten() })
  const { result: logo } = await saveLogoWorkflow(req.scope).run({
    input: { ...parsed.data, actor_id: getAdminActorId(req), action: "create" },
  })
  const fileModule = req.scope.resolve(Modules.FILE)
  res.status(201).json({
    logo: { ...await withMediaUrl(fileModule, logo), ...await resolveStoredLogoFamilies(req.scope, logo) },
  })
}
