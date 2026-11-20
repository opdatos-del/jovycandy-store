/**
 * Contratos de la feature «Galería» de Casa Jovy. El cupo replica el contrato
 * del backend (`apps/backend/src/lib/jovy/brand.ts`): cuatro elementos
 * publicados y activos como máximo en un mismo instante, no cuatro filas.
 */
export const MAX_VISIBLE_GALLERY_ITEMS = 4

export type GalleryStatus = "draft" | "published" | "archived"

export type GalleryItem = {
  id: string
  title: string | null
  description: string | null
  media_file_id: string
  media_url: string | null
  status: GalleryStatus
  enabled: boolean
  sort_order: number
  starts_at: string | null
  ends_at: string | null
}

/** Campos editables del formulario; `id` y `media_url` los resuelve el backend. */
export type GalleryDraft = Omit<GalleryItem, "id" | "media_url">

export const emptyGalleryDraft = (): GalleryDraft => ({
  title: "",
  description: "",
  media_file_id: "",
  status: "draft",
  enabled: true,
  sort_order: 0,
  starts_at: null,
  ends_at: null,
})
