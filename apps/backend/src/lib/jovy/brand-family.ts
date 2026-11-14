import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

/** Familia canónica tal como la expone el módulo de catálogo. */
export type BrandFamilyRef = {
  id: string
  slug: string
  name: string
  active: boolean
}

export type BrandFamilyLabel = {
  id: string
  slug: string
  name: string
}

/**
 * Resolución de la selección de familias de un logo.
 *
 * Mientras `families_linked` es `false` el logo solo tiene el array legado
 * `families` (slugs de texto libre). Esos slugs se resuelven contra la
 * taxonomía canónica por coincidencia exacta y, si no existe la familia, se
 * conservan como etiquetas de compatibilidad para lectura y filtrado: nunca se
 * crean familias ni se descartan valores del histórico.
 */
export type LogoFamilySelection = {
  linked: boolean
  /** Identificadores reales (`jovy_product_family.id`). */
  family_ids: string[]
  family_labels: BrandFamilyLabel[]
  /** Slugs efectivos para el filtro Store, incluidos los legados sin familia. */
  family_slugs: string[]
  /** Valores del array legado, tal cual, para lectura y auditoría. */
  legacy_families: string[]
  /** Valores legado sin familia canónica equivalente. */
  unmapped_families: string[]
}

export function resolveLogoFamilySelection(input: {
  families_linked?: boolean | null
  families?: string[] | null
  family_ids?: string[] | null
  directory: BrandFamilyRef[]
}): LogoFamilySelection {
  const legacy = input.families ?? []
  const bySlug = new Map(input.directory.map((family) => [family.slug, family]))
  const linked = Boolean(input.families_linked)

  if (linked) {
    const selected = new Set(input.family_ids ?? [])
    // Orden de presentación del catálogo, no el orden de inserción de la relación.
    const labels = input.directory.filter((family) => selected.has(family.id))
    return {
      linked,
      family_ids: labels.map((family) => family.id),
      family_labels: labels.map(({ id, slug, name }) => ({ id, slug, name })),
      family_slugs: labels.map((family) => family.slug),
      legacy_families: legacy,
      unmapped_families: legacy.filter((slug) => !bySlug.has(slug)),
    }
  }

  const mapped = legacy.map((slug) => bySlug.get(slug)).filter((family): family is BrandFamilyRef => Boolean(family))
  return {
    linked,
    family_ids: Array.from(new Set(mapped.map((family) => family.id))),
    family_labels: mapped.map(({ id, slug, name }) => ({ id, slug, name })),
    family_slugs: Array.from(new Set(legacy)),
    legacy_families: legacy,
    unmapped_families: legacy.filter((slug) => !bySlug.has(slug)),
  }
}

/**
 * El histórico trataba "sin familias" como visible en todas las familias, y el
 * contrato Store conserva ese alias. El parámetro acepta el identificador real
 * de la familia o su slug.
 */
export function logoMatchesFamily(selection: Pick<LogoFamilySelection, "family_ids" | "family_slugs">, family: string | null) {
  if (!family) return true
  if (selection.family_ids.length === 0 && selection.family_slugs.length === 0) return true
  return selection.family_ids.includes(family) || selection.family_slugs.includes(family)
}

export type BrandFamilyValidation = { missing: string[]; inactive: string[] }

/** Separa ids desconocidos de ids conocidos pero inactivos; ambos rechazan la escritura. */
export function validateFamilySelection(directory: BrandFamilyRef[], requested: string[]): BrandFamilyValidation {
  const byId = new Map(directory.map((family) => [family.id, family]))
  return {
    missing: requested.filter((id) => !byId.has(id)),
    inactive: requested.filter((id) => byId.get(id)?.active === false),
  }
}

type CatalogueFamilies = { listProductFamilies: (filters?: unknown, config?: unknown) => Promise<unknown[]> }

/**
 * `jovy-brand` solo lee la taxonomía del catálogo; nunca la escribe. El catálogo
 * sigue siendo el único dueño de familias y categorías.
 */
export async function loadBrandFamilyDirectory(scope: { resolve: (key: string) => unknown }): Promise<BrandFamilyRef[]> {
  const catalogue = scope.resolve(JOVY_CATALOGUE_MODULE) as CatalogueFamilies
  const families = await catalogue.listProductFamilies({}, { order: { sort_order: "ASC", created_at: "ASC" } })
  return (families as BrandFamilyRef[]).map(({ id, slug, name, active }) => ({ id, slug, name, active }))
}

export type BrandLogoBackfillSource = {
  id: string
  families?: string[] | null
  families_linked?: boolean | null
}

export type BrandFamilyBackfillPlan = {
  mappings: Array<{ logo_id: string; family_ids: string[]; family_slugs: string[] }>
  /** Logos que ya tenían la relación explícita y no se tocan. */
  alreadyLinked: number
  /** Slugs legado sin familia activa con coincidencia exacta. */
  unmapped: Array<{ logo_id: string; slug: string }>
}

/**
 * Plan del backfill `families[] → jovy_product_family` que antes vivía en una
 * migración de `jovy-brand`. La migración podía ejecutarse antes de que
 * `jovy-catalogue` creara su tabla, así que el mapeo es ahora un paso explícito
 * e idempotente:
 *
 * - Coincidencia exacta por slug; no se normaliza ni se inventan familias.
 * - Solo familias activas y vigentes (el directorio ya excluye borradas).
 * - Un logo con `families_linked = true` no se reescribe.
 * - Repetir el plan con el resultado aplicado devuelve cero mapeos.
 */
export function planLogoFamilyBackfill(
  logos: BrandLogoBackfillSource[],
  directory: BrandFamilyRef[],
): BrandFamilyBackfillPlan {
  const activeBySlug = new Map(
    directory.filter((family) => family.active !== false).map((family) => [family.slug, family]),
  )
  const plan: BrandFamilyBackfillPlan = { mappings: [], alreadyLinked: 0, unmapped: [] }

  for (const logo of logos) {
    if (logo.families_linked) {
      plan.alreadyLinked += 1
      continue
    }

    const legacy = Array.from(new Set(logo.families ?? []))
    if (!legacy.length) continue

    const matched = new Map<string, BrandFamilyRef>()
    const unmapped: Array<{ logo_id: string; slug: string }> = []
    for (const slug of legacy) {
      const family = activeBySlug.get(slug)
      if (family) matched.set(family.id, family)
      else unmapped.push({ logo_id: logo.id, slug })
    }

    if (matched.size) {
      plan.mappings.push({
        logo_id: logo.id,
        family_ids: [...matched.keys()],
        family_slugs: [...matched.values()].map((family) => family.slug),
      })
    }
    plan.unmapped.push(...unmapped)
  }

  return plan
}

type BrandLogoForFamilies = { id: string; families?: string[] | null; families_linked?: boolean | null }

/**
 * Resuelve la selección de un logo ya persistido consultando la relación real.
 * Se usa en las respuestas Admin para que `POST`/`PUT` devuelvan la misma forma
 * que `GET` sin duplicar la lógica en cada ruta.
 */
export async function resolveStoredLogoFamilies(
  scope: { resolve: (key: string) => unknown },
  logo: BrandLogoForFamilies,
): Promise<LogoFamilySelection> {
  const brand = scope.resolve(JOVY_BRAND_MODULE) as {
    listLogoFamilies: (filters: Record<string, unknown>) => Promise<Array<{ family_id: string }>>
  }
  const [directory, relations] = await Promise.all([
    loadBrandFamilyDirectory(scope),
    brand.listLogoFamilies({ logo_id: logo.id }),
  ])
  return resolveLogoFamilySelection({
    families_linked: logo.families_linked,
    families: logo.families,
    family_ids: relations.map((relation) => relation.family_id),
    directory,
  })
}
