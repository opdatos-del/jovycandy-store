/** Modalidad comercial: solo catálogo (informativo) o autorizada para la venta. */
export type CommercialMode = "catalog_only" | "sellable"

/** Ciclo de publicación editorial; no altera el estado del producto comercial. */
export type EditorialStatus = "draft" | "published" | "archived"

/**
 * Panel editorial dentro del detalle nativo. Product Module conserva producto,
 * SKU, precio, inventario, variantes e imágenes; esta ficha solo añade datos de
 * presentación y su ciclo de publicación para Store.
 */
export type ProductEditorial = {
  id: string
  product_id: string
  gramaje: string | null
  certifications: string[]
  sort_order: number
  is_new: boolean
  editorial_status: EditorialStatus
  published_at: string | null
  product_missing: boolean
  family: { id: string; slug: string; name: string } | null
  category_keys: string[]
  publish_issues: string[]
  /** null = producto histórico sin clasificar; se trata como informativo. */
  commercial_mode: CommercialMode | null
  /** Códigos pendientes para vender; si no llegan, se tratan como lista vacía. */
  sellable_requirements?: string[]
}

/** Ficha tal como la devuelve el listado filtrado, con su marca de eliminación. */
export type ProductEditorialRecord = ProductEditorial & { deleted: boolean }

/** Estado editable del formulario; el orden se conserva como texto de entrada. */
export type EditorialDraft = {
  gramaje: string
  certifications: string[]
  sort_order: string
  is_new: boolean
  editorial_status: EditorialStatus
  commercial_mode: CommercialMode
}

export type ProductEditorialWidgetProps = {
  data: { id: string; title: string }
}
