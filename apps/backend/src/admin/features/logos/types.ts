/**
 * Contratos de la feature «Logos» del Admin. Los tipos reflejan exactamente lo
 * que devuelve el CMS y las constantes fijan el formato y el límite del carril
 * de logos (20 MB, PNG/JPEG/WebP/GIF) junto con el rango del recorte.
 */

export type Crop = { zoom: number; offset_x: number; offset_y: number }
export type FamilyLabel = { id: string; slug: string; name: string }
export type Logo = {
  id: string
  slug: string
  name: string
  alt: string | null
  families: string[] | null
  families_linked: boolean
  family_ids: string[]
  family_labels: FamilyLabel[]
  unmapped_families: string[]
  media_file_id: string
  media_url: string | null
  crop: Crop | null
  enabled: boolean
  sort_order: number
}
export type Family = { id: string; slug: string; name: string; active: boolean; medusa_category_id: string | null }
export type CatalogueCategory = { key: string; name: string; medusa_category_id: string | null }
export type LogoForm = {
  slug: string
  name: string
  alt: string | null
  family_ids: string[]
  media_file_id: string
  crop: Crop
  enabled: boolean
  sort_order: number
}

/** Estado del filtro local de la lista; no consulta otro endpoint. */
export type LogoStatusFilter = "all" | "active" | "inactive"

/** Formatos admitidos; SVG queda fuera del carril por seguridad de Medusa. */
export const LOGO_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
export const LOGO_IMAGE_MAX_BYTES = 20 * 1024 * 1024

export const DEFAULT_CROP: Crop = { zoom: 1, offset_x: 0, offset_y: 0 }
export const CROP_MIN_ZOOM = 0.5
export const CROP_MAX_ZOOM = 2
export const CROP_ZOOM_STEP = 0.05
/** Desplazamiento máximo del encuadre, en porcentaje del lienzo. */
export const CROP_MAX_OFFSET = 80
export const CROP_FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), " +
  "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

export const emptyLogo = (): LogoForm => ({
  slug: "",
  name: "",
  alt: "",
  family_ids: [],
  media_file_id: "",
  crop: DEFAULT_CROP,
  enabled: true,
  sort_order: 0,
})
