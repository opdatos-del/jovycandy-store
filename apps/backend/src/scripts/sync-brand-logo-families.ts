/**
 * Backfill explícito de familias de logos.
 *
 *   pnpm --dir apps/backend exec medusa exec ./src/scripts/sync-brand-logo-families.ts
 *
 * `Migration20261113160000` crea `jovy_brand_logo_family` y `families_linked`,
 * pero no puede mapear `jovy_brand_logo.families[]` porque `jovy-brand` migra
 * antes que `jovy-catalogue` y la tabla canónica puede no existir todavía. El
 * mapeo es por eso un paso de sincronización posterior, idempotente y sin
 * dependencia del orden de módulos.
 *
 * Reglas:
 * - Solo coincidencia exacta por slug contra una familia activa y vigente.
 * - No se crean familias ni se borran slugs legado.
 * - Un logo ya vinculado (`families_linked = true`) no se reescribe.
 * - Re-ejecutarlo no duplica vínculos.
 */
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"
import { planLogoFamilyBackfill, type BrandFamilyRef, type BrandLogoBackfillSource } from "@jovy/lib/jovy/brand-family"
import { collectAllPages } from "@jovy/lib/jovy/catalogue-sync"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

type BrandService = {
  listLogos: (filters: Record<string, unknown>, config?: Record<string, unknown>) => Promise<BrandLogoBackfillSource[]>
  listLogoFamilies: (filters: Record<string, unknown>) => Promise<Array<{ id: string; family_id: string }>>
  setLogoFamilies: (logoId: string, familyIds: string[]) => Promise<unknown>
}

type CatalogueService = {
  listProductFamilies: (filters?: unknown, config?: unknown) => Promise<BrandFamilyRef[]>
}

export default async function syncBrandLogoFamilies({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const brand = container.resolve(JOVY_BRAND_MODULE) as BrandService
  const catalogue = container.resolve(JOVY_CATALOGUE_MODULE) as CatalogueService

  // `order: id ASC` hace determinista la paginación: sin orden explícito
  // PostgreSQL puede devolver filas distintas entre `skip` y `take`.
  const logos = await collectAllPages((pagination) =>
    brand.listLogos({}, { ...pagination, order: { id: "ASC" } }),
  )
  const families = await collectAllPages((pagination) =>
    catalogue.listProductFamilies({}, { ...pagination, order: { id: "ASC" } }),
  )
  const directory = families.map(({ id, slug, name, active }) => ({ id, slug, name, active }))

  const plan = planLogoFamilyBackfill(logos, directory)
  let createdLinks = 0

  for (const mapping of plan.mappings) {
    const before = await brand.listLogoFamilies({ logo_id: mapping.logo_id })
    const already = new Set(before.map((relation) => relation.family_id))
    await brand.setLogoFamilies(mapping.logo_id, mapping.family_ids)
    createdLinks += mapping.family_ids.filter((familyId) => !already.has(familyId)).length
  }

  logger.info(
    `[jovy-brand] logos: ${logos.length}, mapeados: ${plan.mappings.length}, ya vinculados: ${plan.alreadyLinked}, no mapeados: ${plan.unmapped.length}, vínculos creados: ${createdLinks}`,
  )

  if (plan.unmapped.length) {
    logger.info(
      `[jovy-brand] slugs legado sin familia activa: ${plan.unmapped
        .map(({ logo_id, slug }) => `${logo_id}:${slug}`)
        .join(", ")}`,
    )
  }
}
