import { adminRequest, errorMessage } from "@admin/shared/lib/admin-api"
import {
  MARKETING_IMAGE_ACCEPT,
  MARKETING_IMAGE_MAX_BYTES,
  MARKETING_IMAGE_TYPES,
  uploadMarketingImage,
  validateImageFile,
} from "@admin/shared/lib/media"

/**
 * Contrato de la pestaña Galería. El transporte y la validación viven en
 * `@admin/shared`; aquí solo quedan los nombres del dominio y su carril de 5 MB.
 */
export const GALLERY_MAX_IMAGE_BYTES = MARKETING_IMAGE_MAX_BYTES
export const GALLERY_IMAGE_TYPES = [...MARKETING_IMAGE_TYPES]
export const GALLERY_ACCEPT = MARKETING_IMAGE_ACCEPT

export const galleryRequest = adminRequest
export const galleryErrorMessage = errorMessage
export const uploadGalleryImage = uploadMarketingImage

export function validateGalleryImage(file: File) {
  return validateImageFile(file)
}
