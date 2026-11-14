import { familySlugFrom, uniqueFamilySlug } from "./catalogue"
import {
  planProductFamilyLinks,
  type ProductFamilyLink,
  type SyncFamilyRef,
  type SyncProductRef,
} from "./catalogue-sync"

/**
 * Orquestación de `sync-jovy-catalogue` con sus efectos declarados como puertos.
 *
 * Vive fuera del script porque la regla que importa es de la corrida completa,
 * no de una función pura aislada: las familias creadas en esta misma ejecución
 * también deben alimentar el plan de vínculos. Con el script cableado a Medusa
 * esa garantía sólo se podía comprobar con PostgreSQL; aquí se prueba con
 * dobles en memoria y el script queda como conexión de los puertos.
 */

export type CatalogueSyncCategory = {
  id: string
  name: string
  handle?: string | null
  description?: string | null
  is_active?: boolean | null
  rank?: number | null
}

export type CatalogueSyncFamilyInput = {
  name: string
  slug: string
  description: string | null
  medusa_category_id: string
  sort_order: number
  active: boolean
}

export type CatalogueSyncLinkedFamily = {
  id: string
  products?: Array<{ id: string }> | null
}

export type CatalogueSyncLogger = {
  info: (message: string) => void
  warn: (message: string) => void
}

export type CatalogueSyncPorts = {
  seedCategories: () => Promise<{ created: number }>
  listCategories: () => Promise<CatalogueSyncCategory[]>
  listFamilies: () => Promise<SyncFamilyRef[]>
  createFamily: (input: CatalogueSyncFamilyInput) => Promise<SyncFamilyRef>
  mapFamilyToCategory: (input: { family_id: string; category_id: string }) => Promise<void>
  listProducts: () => Promise<SyncProductRef[]>
  listLinkedFamilies: () => Promise<CatalogueSyncLinkedFamily[]>
  createProductFamilyLink: (link: ProductFamilyLink) => Promise<void>
  logger: CatalogueSyncLogger
}

export type CatalogueSyncReport = {
  createdFamilies: number
  mappedFamilies: number
  linksCreated: number
  alreadyLinked: number
  conflicts: number
  withoutFamily: number
}

/**
 * Ejecuta la sincronización completa. Nunca reemplaza ni borra vínculos: un
 * producto con una familia distinta se reporta como conflicto y queda intacto.
 */
export async function runCatalogueSync(ports: CatalogueSyncPorts): Promise<CatalogueSyncReport> {
  const { logger } = ports
  const report: CatalogueSyncReport = {
    createdFamilies: 0,
    mappedFamilies: 0,
    linksCreated: 0,
    alreadyLinked: 0,
    conflicts: 0,
    withoutFamily: 0,
  }

  const seeded = await ports.seedCategories()
  logger.info(`[jovy-catalogue] categorías de presentación creadas: ${seeded.created}`)

  const categories = await ports.listCategories()
  if (!categories.length) {
    logger.info("[jovy-catalogue] no hay Product Categories: la taxonomía de familias queda vacía")
    return report
  }

  const families = await ports.listFamilies()
  const familyByCategoryId = new Map(families.map((family) => [family.medusa_category_id, family]))
  const familyBySlug = new Map(families.map((family) => [family.slug, family]))
  const takenSlugs = new Set(families.map((family) => family.slug))

  for (const [index, category] of categories.entries()) {
    const current = familyByCategoryId.get(category.id)
    if (current) continue

    const baseSlug = familySlugFrom(category.handle ?? category.name)
    if (!baseSlug) {
      logger.warn(`[jovy-catalogue] categoría sin slug derivable, se omite: ${category.id}`)
      continue
    }
    const existingBySlug = familyBySlug.get(baseSlug)

    if (existingBySlug) {
      // La familia ya existía sin enlace: se completa la correspondencia sin
      // reescribir nombre, descripción, orden ni `active`.
      await ports.mapFamilyToCategory({
        family_id: existingBySlug.id,
        category_id: category.id,
      })
      existingBySlug.medusa_category_id = category.id
      familyByCategoryId.set(category.id, existingBySlug)
      report.mappedFamilies += 1
      continue
    }

    const slug = uniqueFamilySlug(baseSlug, takenSlugs)
    takenSlugs.add(slug)
    const family = await ports.createFamily({
      name: category.name,
      slug,
      description: category.description ?? null,
      medusa_category_id: category.id,
      sort_order: category.rank ?? index,
      active: category.is_active ?? true,
    })
    familyByCategoryId.set(category.id, family)
    familyBySlug.set(slug, family)
    report.createdFamilies += 1
  }

  logger.info(
    `[jovy-catalogue] familias creadas: ${report.createdFamilies}, mapeadas: ${report.mappedFamilies}`,
  )

  const products = await ports.listProducts()
  if (!products.length) {
    logger.info("[jovy-catalogue] no hay productos: no se crean vínculos familia-producto")
    return report
  }

  const linkedFamilies = await ports.listLinkedFamilies()
  const existingLinks: ProductFamilyLink[] = linkedFamilies.flatMap((family) =>
    (family.products ?? []).map((product) => ({ product_id: product.id, family_id: family.id })),
  )

  // El índice es por categoría, no por familia: se deduplica por id para que el
  // plan reciba exactamente una entrada por familia, incluidas las creadas en
  // esta corrida (el bug corregido consistía en pasar la lista previa).
  const familiesForLinks = [
    ...new Map(
      [...familyByCategoryId.values()].map((family) => [family.id, family] as const),
    ).values(),
  ]

  const plan = planProductFamilyLinks({
    products,
    families: familiesForLinks,
    existingLinks,
  })

  for (const pending of plan.links) {
    await ports.createProductFamilyLink(pending)
    report.linksCreated += 1
  }

  for (const conflict of plan.conflicts) {
    logger.warn(
      `[jovy-catalogue] producto ${conflict.product_id} ya tiene familia (${conflict.existing_family_ids.join(", ")}); no se reemplaza por ${conflict.family_id}`,
    )
  }

  report.alreadyLinked = plan.alreadyLinked
  report.conflicts = plan.conflicts.length
  report.withoutFamily = plan.withoutFamily

  logger.info(
    `[jovy-catalogue] vínculos familia-producto creados: ${report.linksCreated}, ya vinculados: ${report.alreadyLinked}, conflictos: ${report.conflicts}, productos sin familia: ${report.withoutFamily}`,
  )

  return report
}
