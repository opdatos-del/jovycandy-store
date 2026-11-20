import { adminRequest } from "@admin/shared/lib/admin-api"

/** Contrato del carril general de imágenes del CMS (5 MB). */
export const MARKETING_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export const MARKETING_IMAGE_ACCEPT = MARKETING_IMAGE_TYPES.join(",")
export const MARKETING_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export type UploadedImage = { id: string; url: string | null }

type ValidateImageOptions = {
  types?: readonly string[]
  maxBytes?: number
  formatLabel?: string
  maxLabel?: string
}

/** Validación de cliente; el servidor vuelve a validar firma y MIME. */
export function validateImageFile(file: File, options: ValidateImageOptions = {}): string | null {
  const types = options.types ?? MARKETING_IMAGE_TYPES
  const maxBytes = options.maxBytes ?? MARKETING_IMAGE_MAX_BYTES
  const formatLabel = options.formatLabel ?? "PNG, JPEG o WebP"
  const maxLabel = options.maxLabel ?? `${Math.round(maxBytes / 1024 / 1024)} MB`

  if (!types.includes(file.type)) return `Formato no admitido; usa ${formatLabel}.`
  if (file.size > maxBytes) return `Excede el límite de ${maxLabel}.`
  return null
}

export async function uploadImageTo(endpoint: string, file: File): Promise<UploadedImage> {
  const body = new FormData()
  body.append("files", file)
  const result = await adminRequest<{ file: { id: string; url?: string | null } }>(endpoint, {
    method: "POST",
    body,
  })
  return { id: result.file.id, url: result.file.url ?? null }
}

/** Carril compartido de marketing: PNG/JPEG/WebP hasta 5 MB. */
export const uploadMarketingImage = (file: File) =>
  uploadImageTo("/admin/jovy/marketing/media", file)

// Nombres heredados que consumen las pantallas ya existentes.
export const ACCEPTED_IMAGE_TYPES = MARKETING_IMAGE_ACCEPT
export type UploadedJovyImage = UploadedImage
export const uploadJovyImage = uploadMarketingImage
