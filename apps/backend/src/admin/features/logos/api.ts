import { adminRequest } from "@admin/shared/lib/admin-api"
import { uploadImageTo, type UploadedImage } from "@admin/shared/lib/media"
import {
  LOGO_IMAGE_MAX_BYTES,
  LOGO_IMAGE_TYPES,
  type CatalogueCategory,
  type Family,
  type Logo,
  type LogoForm,
} from "@admin/features/logos/types"

/**
 * Única puerta HTTP de la feature «Logos». Conserva los endpoints del CMS y el
 * carril de media propio de logos (`/admin/jovy/brand/logos/media`, 20 MB).
 */

const LOGO_ENDPOINT = "/admin/jovy/brand/logos"
const FAMILY_ENDPOINT = "/admin/jovy/catalogue/families"
const CATEGORY_ENDPOINT = "/admin/jovy/catalogue/categories"
export const LOGO_MEDIA_ENDPOINT = `${LOGO_ENDPOINT}/media`

export const fetchLogos = async (): Promise<Logo[]> =>
  (await adminRequest<{ logos: Logo[] }>(LOGO_ENDPOINT)).logos

export const fetchCategories = async (): Promise<CatalogueCategory[]> =>
  (await adminRequest<{ categories: CatalogueCategory[] }>(CATEGORY_ENDPOINT)).categories

/** Sin `categoryKey` devuelve el directorio completo de familias. */
export const fetchFamilies = async (categoryKey = ""): Promise<Family[]> =>
  (await adminRequest<{ families: Family[] }>(
    categoryKey ? `${FAMILY_ENDPOINT}?category_key=${encodeURIComponent(categoryKey)}` : FAMILY_ENDPOINT,
  )).families

export const uploadLogoMedia = (file: File): Promise<UploadedImage> =>
  uploadImageTo(LOGO_MEDIA_ENDPOINT, file)

/**
 * Validación de cliente con los mensajes del carril de logos. Los formatos y el
 * límite viven en `types.ts`; el servidor vuelve a validar firma y MIME.
 */
export function validateLogoMedia(file: File): string | null {
  if (!LOGO_IMAGE_TYPES.includes(file.type)) {
    return "El recurso debe ser PNG, JPEG, WebP o GIF. No se admiten SVG."
  }
  if (file.size > LOGO_IMAGE_MAX_BYTES) {
    return "El recurso excede 20 MB. Selecciona una imagen PNG, JPEG, WebP o GIF de máximo 20 MB."
  }
  return null
}

/** `id` nulo crea; con `id` actualiza el logo existente. */
export async function saveLogo(id: string | null, form: LogoForm): Promise<void> {
  await adminRequest(id ? `${LOGO_ENDPOINT}/${id}` : LOGO_ENDPOINT, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(form),
  })
}

export async function setLogoEnabled(id: string, enabled: boolean): Promise<void> {
  await adminRequest(`${LOGO_ENDPOINT}/${id}`, { method: "PUT", body: JSON.stringify({ enabled }) })
}

export async function deleteLogo(id: string): Promise<void> {
  await adminRequest(`${LOGO_ENDPOINT}/${id}`, { method: "DELETE" })
}

export async function reorderLogos(ids: string[]): Promise<void> {
  await adminRequest(`${LOGO_ENDPOINT}/reorder`, { method: "POST", body: JSON.stringify({ ids }) })
}
