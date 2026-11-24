import { adminRequest } from "@admin/shared/lib/admin-api"

type EditorialRecord = { editorial_status?: string | null }

export async function fetchEditorialStatus(productId: string) {
  const response = await adminRequest<{ products: EditorialRecord[] }>(
    `/admin/jovy/products/editorial?product_id=${encodeURIComponent(productId)}`,
  )
  return response.products[0]?.editorial_status ?? null
}
