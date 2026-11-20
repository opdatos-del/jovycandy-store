/** Tarjeta de presentación del catálogo (claves públicas fijas del storefront). */
export type CatalogueCategory = {
  id: string
  key: string
  name: string
  description: string | null
  sort_order: number
  active: boolean
  coming_soon: boolean
  interaction_locked: boolean
  image_file_id: string | null
  image_url: string | null
  image_resolved_url: string | null
  medusa_category_id: string | null
}

/** Familia canónica con los productos vinculados por el Module Link. */
export type CatalogueFamily = {
  id: string
  name: string
  slug: string
  description: string | null
  medusa_category_id: string | null
  sort_order: number
  active: boolean
  product_ids: string[]
}

export type MedusaCategory = { id: string; name: string }

export type CatalogueDraft = {
  name: string
  description: string
  active: boolean
  coming_soon: boolean
  interaction_locked: boolean
  medusa_category_id: string
  image_file_id: string | null
  image_url: string
}

export const draftFromCategory = (category: CatalogueCategory): CatalogueDraft => ({
  name: category.name,
  description: category.description ?? "",
  active: category.active,
  coming_soon: category.coming_soon,
  interaction_locked: category.interaction_locked,
  medusa_category_id: category.medusa_category_id ?? "",
  image_file_id: category.image_file_id,
  image_url: category.image_url ?? "",
})

/** `coming_soon` obliga al bloqueo; el storefront recibe siempre el valor efectivo. */
export const effectiveInteractionLocked = (draft: CatalogueDraft) =>
  draft.coming_soon || draft.interaction_locked

export type StorefrontCatalogueCategory = {
  id: string
  key: string
  name: string
  description: string | null
  sort_order: number
  coming_soon: boolean
  interaction_locked: boolean
  image_file_id: string | null
  image_url: string | null
  medusa_category_id: string | null
}

/**
 * Réplica de `GET /store/jovy/catalogue/categories`: publica solo tarjetas
 * activas y nunca expone la bandera editorial `active`.
 */
export function toStorefrontCategories(categories: CatalogueCategory[]): StorefrontCatalogueCategory[] {
  return categories
    .filter((category) => category.active)
    .map((category) => ({
      id: category.id,
      key: category.key,
      name: category.name,
      description: category.description,
      sort_order: category.sort_order,
      coming_soon: category.coming_soon,
      interaction_locked: category.coming_soon || category.interaction_locked,
      image_file_id: category.image_file_id,
      image_url: category.image_resolved_url ?? category.image_url,
      medusa_category_id: category.medusa_category_id,
    }))
}
