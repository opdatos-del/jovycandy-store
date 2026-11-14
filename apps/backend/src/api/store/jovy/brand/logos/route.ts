import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import {
  loadBrandFamilyDirectory,
  logoMatchesFamily,
  resolveLogoFamilySelection,
} from "@jovy/lib/jovy/brand-family"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"

/**
 * Logos activos ordenados por `sort_order`. El filtro `family` acepta el
 * identificador real de la familia o su slug y se resuelve con la relación
 * `jovy_brand_logo_family`; los logos que aún no fueron vinculados siguen
 * filtrándose con su array legado `families` por coincidencia exacta, y un logo
 * sin familias se mantiene visible para cualquier familia (alias histórico).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_BRAND_MODULE)
  const files = req.scope.resolve(Modules.FILE)
  const family = typeof req.query.family === "string" ? req.query.family : null

  const logos = await service.listLogos({ enabled: true }, { order: { sort_order: "ASC", created_at: "ASC" } })
  const [directory, relations] = await Promise.all([
    loadBrandFamilyDirectory(req.scope),
    logos.length ? service.listLogoFamilies({ logo_id: logos.map((logo) => logo.id) }) : Promise.resolve([]),
  ])
  const familyIdsByLogo = new Map<string, string[]>()
  for (const relation of relations) {
    familyIdsByLogo.set(relation.logo_id, [...(familyIdsByLogo.get(relation.logo_id) ?? []), relation.family_id])
  }

  const selected = logos
    .map((logo) => ({
      logo,
      selection: resolveLogoFamilySelection({
        families_linked: logo.families_linked,
        families: logo.families,
        family_ids: familyIdsByLogo.get(logo.id),
        directory,
      }),
    }))
    .filter(({ selection }) => logoMatchesFamily(selection, family))

  res.json({
    logos: await Promise.all(selected.map(async ({ logo, selection }) => {
      let media_url: null | string = null
      try {
        media_url = (await files.retrieveFile(logo.media_file_id)).url
      } catch {
        // Un archivo local ausente degrada a `null` en lugar de exponer el error de storage.
      }
      return {
        id: logo.id,
        slug: logo.slug,
        name: logo.name,
        alt: logo.alt,
        families: logo.families,
        family_ids: selection.family_ids,
        family_slugs: selection.family_slugs,
        crop: logo.crop,
        sort_order: logo.sort_order,
        media_url,
      }
    })),
  })
}
