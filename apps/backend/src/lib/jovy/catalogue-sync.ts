import { MedusaError } from "@medusajs/framework/utils"

/**
 * Planificación pura de la sincronización de catálogo.
 *
 * El script `sync-jovy-catalogue` lee datos reales de Medusa y del módulo de
 * catálogo; estas funciones no tocan la base de datos para poder probar la
 * paginación, el orden determinista de categorías y la regla "un producto, como
 * máximo una familia" sin levantar PostgreSQL.
 */

export type SyncCategoryRef = {
  id: string
  rank?: number | null
}

export type SyncProductRef = {
  id: string
  categories?: SyncCategoryRef[] | null
}

export type SyncFamilyRef = {
  id: string
  slug: string
  medusa_category_id?: string | null
}

export type ProductFamilyLink = {
  product_id: string
  family_id: string
}

export type ProductFamilyConflict = {
  product_id: string
  existing_family_ids: string[]
  family_id: string
}

export type ProductFamilyLinkPlan = {
  links: ProductFamilyLink[]
  alreadyLinked: number
  conflicts: ProductFamilyConflict[]
  withoutFamily: number
}

export const CATALOGUE_SYNC_PAGE_SIZE = 200
/**
 * Tope defensivo: si el servidor ignorara `skip` la paginación no terminaría.
 * Es mucho mayor que cualquier catálogo local y falla con un mensaje claro en
 * lugar de truncar en silencio (el bug que corrige esta función).
 */
export const CATALOGUE_SYNC_MAX_RECORDS = 100_000

/**
 * Pagina hasta agotar la fuente. Si una página devuelve menos filas que el
 * tamaño pedido, esa era la última. El tope sólo se alcanza con datos anómalos
 * o con un servidor que no respeta `skip`, y entonces se falla de forma visible.
 */
export async function collectAllPages<T>(
  fetchPage: (pagination: { take: number; skip: number }) => Promise<T[]>,
  pageSize = CATALOGUE_SYNC_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "El tamaño de página debe ser un entero positivo")
  }

  const rows: T[] = []
  for (let skip = 0; ; skip += pageSize) {
    const page = await fetchPage({ take: pageSize, skip })
    rows.push(...page)
    if (page.length < pageSize) return rows
    if (rows.length >= CATALOGUE_SYNC_MAX_RECORDS) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `La sincronización superó ${CATALOGUE_SYNC_MAX_RECORDS} registros; revisa la paginación antes de continuar`,
      )
    }
  }
}

/**
 * El orden de `product.categories` no está garantizado por el Product Module.
 * Se ordena por `rank` y, para desempatar, por `id`: la misma entrada produce
 * siempre la misma familia elegida.
 */
export function orderProductCategories(categories: SyncCategoryRef[] | null | undefined): SyncCategoryRef[] {
  return [...(categories ?? [])].sort((a, b) => {
    const rank = (a.rank ?? 0) - (b.rank ?? 0)
    if (rank !== 0) return rank
    return a.id.localeCompare(b.id)
  })
}

/**
 * Calcula los vínculos que faltan sin crear segundas familias. Un producto con
 * un vínculo existente hacia otra familia se reporta como conflicto y no se
 * modifica: la sincronización nunca borra ni reemplaza relaciones.
 */
export function planProductFamilyLinks(input: {
  products: SyncProductRef[]
  families: SyncFamilyRef[]
  existingLinks: ProductFamilyLink[]
}): ProductFamilyLinkPlan {
  const familyByCategoryId = new Map<string, SyncFamilyRef>()
  for (const family of input.families) {
    if (family.medusa_category_id) familyByCategoryId.set(family.medusa_category_id, family)
  }

  const linkedByProduct = new Map<string, Set<string>>()
  for (const link of input.existingLinks) {
    const families = linkedByProduct.get(link.product_id) ?? new Set<string>()
    families.add(link.family_id)
    linkedByProduct.set(link.product_id, families)
  }

  const plan: ProductFamilyLinkPlan = { links: [], alreadyLinked: 0, conflicts: [], withoutFamily: 0 }

  for (const product of input.products) {
    const family = orderProductCategories(product.categories)
      .map((category) => familyByCategoryId.get(category.id))
      .find((candidate): candidate is SyncFamilyRef => Boolean(candidate))

    if (!family) {
      plan.withoutFamily += 1
      continue
    }

    const existing = linkedByProduct.get(product.id) ?? new Set<string>()
    if (existing.has(family.id) && existing.size === 1) {
      plan.alreadyLinked += 1
      continue
    }

    if (existing.size > 0) {
      plan.conflicts.push({
        product_id: product.id,
        existing_family_ids: [...existing].sort(),
        family_id: family.id,
      })
      continue
    }

    plan.links.push({ product_id: product.id, family_id: family.id })
    existing.add(family.id)
    linkedByProduct.set(product.id, existing)
  }

  return plan
}
