import { adminRequest } from "@admin/shared/lib/admin-api"
import { uploadMarketingImage, type UploadedImage } from "@admin/shared/lib/media"
import type { CatalogueCategory, CatalogueFamily, MedusaCategory } from "./types"

/**
 * Operaciones HTTP de Categorías del catálogo sobre los endpoints ya
 * publicados de `jovy-content`. No hay contratos alternativos ni rutas nuevas:
 * la feature sólo agrupa el cliente y la pantalla.
 */

const CATEGORIES_PATH = "/admin/jovy/catalogue/categories"
const FAMILIES_PATH = "/admin/jovy/catalogue/families"
const MEDUSA_CATEGORIES_PATH = "/admin/product-categories?limit=200&order=name"

export async function fetchCategories(): Promise<CatalogueCategory[]> {
  const result = await adminRequest<{ categories: CatalogueCategory[] }>(CATEGORIES_PATH)
  return result.categories
}

export async function fetchFamilies(): Promise<CatalogueFamily[]> {
  const result = await adminRequest<{ families: CatalogueFamily[] }>(FAMILIES_PATH)
  return result.families
}

/** Taxonomía comercial de Medusa; sin categorías el catálogo sigue editable. */
export async function fetchMedusaCategories(): Promise<MedusaCategory[]> {
  const result = await adminRequest<{ product_categories?: MedusaCategory[] }>(MEDUSA_CATEGORIES_PATH)
  return result.product_categories ?? []
}

export function updateCategory(id: string, body: Record<string, unknown>) {
  return adminRequest(`${CATEGORIES_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function reorderCategories(ids: string[]) {
  return adminRequest(`${CATEGORIES_PATH}/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

export function seedCategories() {
  return adminRequest<{ created: number }>(`${CATEGORIES_PATH}/seed`, {
    method: "POST",
    body: JSON.stringify({}),
  })
}

/** Carril compartido de imágenes del CMS: PNG/JPEG/WebP hasta 5 MB. */
export const uploadCategoryImage = (file: File): Promise<UploadedImage> => uploadMarketingImage(file)
