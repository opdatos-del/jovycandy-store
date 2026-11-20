import { adminRequest } from "@admin/shared/lib/admin-api"
import type {
  CommercialMode,
  EditorialDraft,
  EditorialStatus,
  ProductEditorial,
  ProductEditorialRecord,
} from "./types"

/**
 * Operaciones HTTP de la ficha editorial. El producto comercial sigue viviendo
 * en el Product Module: aquí solo se leen y escriben presentación, orden,
 * certificaciones y ciclo de publicación.
 */

const PRODUCTS_PATH = "/admin/jovy/products"

export type EditorialPayload = {
  gramaje: string | null
  certifications: string[]
  sort_order: number
  is_new: boolean
  editorial_status: EditorialStatus
  commercial_mode: CommercialMode
}

export type EditorialSaveResult = { editorial: ProductEditorial; deleted: boolean }

/**
 * El listado filtrado responde 200 y evita registrar el 404 esperado de una
 * ficha aún inexistente durante cada visita al detalle nativo.
 */
export async function listEditorial(productId: string): Promise<ProductEditorialRecord[]> {
  const result = await adminRequest<{ products: ProductEditorialRecord[] }>(
    `${PRODUCTS_PATH}/editorial?product_id=${encodeURIComponent(productId)}`,
  )
  return result.products
}

export function saveEditorial(productId: string, payload: EditorialPayload) {
  return adminRequest<EditorialSaveResult>(`${PRODUCTS_PATH}/${productId}/editorial`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function deleteEditorial(productId: string) {
  return adminRequest<void>(`${PRODUCTS_PATH}/${productId}/editorial`, { method: "DELETE" })
}

export function restoreEditorial(productId: string) {
  return adminRequest<void>(`${PRODUCTS_PATH}/${productId}/editorial/restore`, { method: "POST" })
}

/** Traduce el borrador de la UI al cuerpo del endpoint con el orden ya validado. */
export function payloadFromDraft(draft: EditorialDraft, sortOrder: number): EditorialPayload {
  return {
    gramaje: draft.gramaje.trim() || null,
    certifications: draft.certifications,
    sort_order: sortOrder,
    is_new: draft.is_new,
    editorial_status: draft.editorial_status,
    commercial_mode: draft.commercial_mode,
  }
}
