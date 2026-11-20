import { adminRequest, errorMessage } from "@admin/shared/lib/admin-api"
import {
  MARKETING_IMAGE_ACCEPT,
  MARKETING_IMAGE_MAX_BYTES,
  MARKETING_IMAGE_TYPES,
  uploadMarketingImage,
  validateImageFile,
} from "@admin/shared/lib/media"
import type { GalleryItem, GalleryStatus } from "./types"

/**
 * Única puerta HTTP de la feature «Galería». Conserva los endpoints del CMS;
 * el transporte y la validación viven en `@admin/shared`, aquí solo quedan los
 * nombres del dominio y su carril de 5 MB.
 */

const GALLERY_ENDPOINT = "/admin/jovy/brand/gallery"

export const GALLERY_MAX_IMAGE_BYTES = MARKETING_IMAGE_MAX_BYTES
export const GALLERY_IMAGE_TYPES = [...MARKETING_IMAGE_TYPES]
export const GALLERY_ACCEPT = MARKETING_IMAGE_ACCEPT

export const galleryErrorMessage = errorMessage

export const listGallery = async (): Promise<GalleryItem[]> =>
  (await adminRequest<{ items: GalleryItem[] }>(GALLERY_ENDPOINT)).items

export function createGalleryItem(body: Record<string, unknown>) {
  return adminRequest(GALLERY_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function updateGalleryItem(id: string, body: Record<string, unknown>) {
  return adminRequest(`${GALLERY_ENDPOINT}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function deleteGalleryItem(id: string) {
  return adminRequest(`${GALLERY_ENDPOINT}/${id}`, { method: "DELETE" })
}

export function reorderGallery(ids: string[]) {
  return adminRequest(`${GALLERY_ENDPOINT}/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

export function setGalleryStatus(id: string, status: GalleryStatus) {
  return updateGalleryItem(id, { status })
}

export function setGalleryEnabled(id: string, enabled: boolean) {
  return updateGalleryItem(id, { enabled })
}

export const uploadGalleryImage = uploadMarketingImage

export function validateGalleryImage(file: File) {
  return validateImageFile(file)
}
