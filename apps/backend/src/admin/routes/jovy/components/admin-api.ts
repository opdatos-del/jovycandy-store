/**
 * Punto de compatibilidad para las pantallas que ya importaban este archivo.
 * La implementación vive en `@admin/shared` para que todas las features usen
 * un único cliente HTTP, un único formato de error y las mismas reglas de
 * imagen.
 */
export {
  AdminApiError,
  adminQuery,
  adminRequest,
  downloadAdminFile,
  errorMessage,
  saveBlob,
} from "@admin/shared/lib/admin-api"
export type { AdminDownload, ApiErrorBody } from "@admin/shared/lib/admin-api"

export {
  ACCEPTED_IMAGE_TYPES,
  MARKETING_IMAGE_ACCEPT,
  MARKETING_IMAGE_MAX_BYTES,
  MARKETING_IMAGE_TYPES,
  uploadImageTo,
  uploadJovyImage,
  uploadMarketingImage,
  validateImageFile,
} from "@admin/shared/lib/media"
export type { UploadedImage, UploadedJovyImage } from "@admin/shared/lib/media"

export {
  HEX_COLOR_PATTERN,
  expandHexColor,
  isValidHexColor,
} from "@admin/shared/lib/color"
