import type { CommercialMode, EditorialDraft, EditorialStatus, ProductEditorial } from "./types"

/** Catálogo cerrado validado por servidor; el orden también es presentación. */
export const CERTIFICATIONS = ["SGS", "OU Kosher", "Halal"] as const

export const STATUS_LABELS: Record<EditorialStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
}

export const STATUS_BADGE: Record<EditorialStatus, "grey" | "green" | "orange"> = {
  draft: "grey",
  published: "green",
  archived: "orange",
}

export const COMMERCIAL_MODE_BADGE: Record<CommercialMode, { label: string; color: "grey" | "green" }> = {
  catalog_only: { label: "CATALOG_ONLY — Informativo", color: "grey" },
  sellable: { label: "SELLABLE — Vendible", color: "green" },
}

/** Códigos del servidor traducidos; un código desconocido se muestra tal cual. */
export const SELLABLE_REQUIREMENT_LABELS: Record<string, string> = {
  variants: "Variantes del producto configuradas",
  prices: "Precios definidos",
  sales_channel: "Canal de ventas asignado",
  inventory_policy: "Política de inventario configurada",
}

export const SORT_ORDER_ERROR = "El orden debe ser un entero mayor o igual a cero."

/** Nunca se preselecciona "sellable": por defecto toda ficha nueva es informativa. */
export const emptyDraft = (): EditorialDraft => ({
  gramaje: "",
  certifications: [],
  sort_order: "0",
  is_new: false,
  editorial_status: "draft",
  commercial_mode: "catalog_only",
})

export const draftFrom = (editorial: ProductEditorial): EditorialDraft => ({
  gramaje: editorial.gramaje ?? "",
  certifications: editorial.certifications,
  sort_order: String(editorial.sort_order),
  is_new: editorial.is_new,
  editorial_status: editorial.editorial_status,
  commercial_mode: editorial.commercial_mode === "sellable" ? "sellable" : "catalog_only",
})

/** `null` cuando el texto no representa un entero no negativo utilizable. */
export const parseSortOrder = (value: string): number | null => {
  const sortOrder = Number(value)
  return Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : null
}
