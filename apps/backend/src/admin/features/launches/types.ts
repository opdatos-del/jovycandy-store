/**
 * Tipos y constantes de Nuevos Lanzamientos. La entidad es la del módulo
 * `jovy-launches`; el Admin sólo la administra y no redefine su contrato.
 */

/** Lanzamiento administrado por el módulo `jovy-launches`. */
export type Launch = {
  id: string
  product_id: string | null
  title: string
  description: string | null
  image_file_id: string | null
  image_url: string | null
  image_resolved_url: string | null
  sort_order: number
  active: boolean
}

export type ProductOption = { id: string; title: string; thumbnail?: string | null }

export type LaunchSettings = { background_color: string }

export type LaunchDraft = {
  title: string
  description: string
  product: ProductOption | null
  image_file_id: string | null
  image_url: string
  preview_url: string | null
  active: boolean
}

/** Paleta conservada del administrador histórico de Nuevos Lanzamientos. */
export const HERO_COLOR_PRESETS = [
  "#00AFAA",
  "#00A3E0",
  "#FF5A5F",
  "#FF7A00",
  "#FFC400",
  "#5A9E3A",
  "#7B61FF",
  "#111827",
]

/** Color de partida mientras no se conoce el valor persistido. */
export const DEFAULT_LAUNCH_COLOR = "#00afaa"

/** Carril compartido de imágenes: PNG/JPEG/WebP hasta 5 MB. */
export const LAUNCH_IMAGE_TYPES: string[] = ["image/png", "image/jpeg", "image/webp"]
export const LAUNCH_IMAGE_MAX_BYTES = 5 * 1024 * 1024
