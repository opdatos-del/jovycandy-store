import { adminRequest } from "@admin/shared/lib/admin-api"
import {
  MARKETING_IMAGE_MAX_BYTES,
  MARKETING_IMAGE_TYPES,
  uploadMarketingImage,
} from "@admin/shared/lib/media"
import type { Banner, BannerDraft, Status } from "./types"

/**
 * Operaciones HTTP del gestor de anuncios sobre los endpoints existentes
 * `/admin/jovy/marketing/banners` y `/admin/jovy/marketing/media`. No hay
 * endpoints nuevos ni contratos alternativos.
 */

const BANNERS_PATH = "/admin/jovy/marketing/banners"

export async function fetchBanners(): Promise<Banner[]> {
  const result = await adminRequest<{ banners: Banner[] }>(BANNERS_PATH)
  return result.banners
}

export async function fetchBannerMediaUrl(mediaId: string): Promise<string> {
  const result = await adminRequest<{ file: { url: string } }>(
    `/admin/jovy/marketing/media/${mediaId}`,
  )
  return result.file.url
}

/** Cuerpo completo del formulario; recorta textos y omite campos vacíos. */
export function bannerPayload(draft: BannerDraft) {
  return {
    slot: draft.slot,
    translations: {
      es: {
        title: draft.translations.es.title.trim(),
        description: draft.translations.es.description?.trim() || undefined,
        cta_label: draft.translations.es.cta_label?.trim() || undefined,
        alt: draft.translations.es.alt.trim(),
      },
      en: {
        title: draft.translations.en.title.trim(),
        description: draft.translations.en.description?.trim() || undefined,
        cta_label: draft.translations.en.cta_label?.trim() || undefined,
        alt: draft.translations.en.alt.trim(),
      },
    },
    status: draft.status,
    enabled: draft.enabled,
    auto_open: draft.auto_open,
    frequency: draft.frequency,
    rotation_seconds: draft.rotation_seconds,
    priority: draft.priority,
    sort_order: draft.sort_order,
    media_file_id: draft.media_file_id || null,
    cta_url: draft.cta_url?.trim() || null,
    starts_at: draft.starts_at,
    ends_at: draft.ends_at,
  }
}

export function createBanner(draft: BannerDraft) {
  return adminRequest(BANNERS_PATH, {
    method: "POST",
    body: JSON.stringify(bannerPayload(draft)),
  })
}

export function updateBanner(id: string, body: unknown) {
  return adminRequest(`${BANNERS_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function changeBannerStatus(id: string, status: Status) {
  return updateBanner(id, { status })
}

export function deleteBanner(id: string) {
  return adminRequest(`${BANNERS_PATH}/${id}`, { method: "DELETE" })
}

export function reorderBanners(ids: string[]) {
  return adminRequest(`${BANNERS_PATH}/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

/**
 * Validación de cliente con los mensajes del gestor. El servidor vuelve a
 * validar firma y MIME; los límites son los del carril compartido (5 MB).
 */
export function validateBannerImage(file: File): string | null {
  if (!MARKETING_IMAGE_TYPES.includes(file.type as (typeof MARKETING_IMAGE_TYPES)[number])) {
    return "Solo se aceptan imágenes PNG, JPEG o WebP."
  }
  if (file.size > MARKETING_IMAGE_MAX_BYTES) {
    return "La imagen supera el límite de 5 MB."
  }
  return null
}

export function uploadBannerImage(file: File) {
  return uploadMarketingImage(file)
}
