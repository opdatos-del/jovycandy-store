import { adminRequest } from "@admin/shared/lib/admin-api"
import { uploadImageTo, type UploadedImage } from "@admin/shared/lib/media"

export type CardVisualMode = "zoom" | "swap" | "layered" | "none"

export type ProductVisualMetadata = {
  id: string
  title?: string
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
}

export const VISUAL_KEYS = [
  "card_hover_enabled",
  "card_hover_mode",
  "card_hover_preset",
  "card_hover_swap_url",
  "card_hover_overlay_url",
  "card_hover_full_url",
  "card_hover_background",
  "card_hover_duration_ms",
  "card_hover_intensity",
  "card_visual_version",
] as const

export const CARD_PRESETS = [
  { value: "inherit", label: "Heredar configuración" },
  { value: "jovy-default", label: "Jovy Default · zoom" },
  { value: "jovy-gummies", label: "Jovy Gummies · explosión" },
  { value: "jovy-swap", label: "Jovy Swap · cambio de imagen" },
  { value: "jovy-none", label: "Jovy None · sin animación" },
] as const

export const CARD_MODES = [
  { value: "inherit", label: "Heredar configuración" },
  { value: "zoom", label: "Zoom" },
  { value: "swap", label: "Cambio de imagen" },
  { value: "layered", label: "Explosión de gomitas" },
  { value: "none", label: "Sin animación" },
] as const

export async function fetchProductVisual(productId: string): Promise<ProductVisualMetadata> {
  const response = await adminRequest<{ product: ProductVisualMetadata }>(
    `/admin/products/${encodeURIComponent(productId)}?fields=id,title,thumbnail,metadata`,
  )
  return response.product
}

export async function uploadCardAsset(file: File): Promise<UploadedImage> {
  return uploadImageTo("/admin/jovy/product-card-visual/media", file)
}

export type FamilyVisual = {
  id: string
  name: string
  slug: string
  card_preset?: string | null
  product_ids: string[]
}

export async function fetchVisualFamilies(): Promise<FamilyVisual[]> {
  const response = await adminRequest<{ families: FamilyVisual[] }>("/admin/jovy/catalogue/families")
  return response.families
}

export async function updateFamilyPreset(familyId: string, preset: string | null) {
  return adminRequest<{ family: FamilyVisual }>(
    `/admin/jovy/catalogue/families/${encodeURIComponent(familyId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ card_preset: preset }),
    },
  )
}

/**
 * Guarda solo las claves visuales y conserva el resto de metadata.
 * Medusa fusiona metadata de primer nivel; el objeto se envía completo para no
 * perder claves ajenas.
 */
export async function saveProductVisual(
  productId: string,
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<ProductVisualMetadata> {
  const next = { ...current }
  for (const key of VISUAL_KEYS) delete next[key]
  Object.assign(next, patch)

  const response = await adminRequest<{ product: ProductVisualMetadata }>(
    `/admin/products/${encodeURIComponent(productId)}?fields=id,title,thumbnail,metadata`,
    {
      method: "POST",
      body: JSON.stringify({ metadata: next }),
    },
  )
  return response.product
}
