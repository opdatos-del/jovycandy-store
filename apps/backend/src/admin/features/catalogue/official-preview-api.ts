import { adminRequest } from "@admin/shared/lib/admin-api"

export type OfficialPreviewField = "title" | "description" | "weight"

export type OfficialPreviewChange = {
  field: OfficialPreviewField
  current: string | number | null
  official: string | number | null
}

export type OfficialPreviewDiagnostic = {
  field: "status" | "category" | "family" | "specs" | "source_updated_at"
  current: string
  official: string
}

export type OfficialPreviewEntry = {
  externalId: string
  productId: string | null
  handle: string
  state: "missing" | "different" | "equal"
  changes: OfficialPreviewChange[]
  diagnostics: OfficialPreviewDiagnostic[]
  variants: Array<{
    sku: string
    state: "missing" | "different" | "equal"
    currentTitle: string | null
    officialTitle: string
    currentGrams: number | null
    officialGrams: number
    hasMxnPrice: boolean
  }>
}

export type OfficialPreviewResponse = { preview: OfficialPreviewEntry[] }

const PATH = "/admin/jovy/catalogue/official-preview"

export const fetchOfficialCatalogPreview = () =>
  adminRequest<OfficialPreviewResponse>(PATH)

export const approveOfficialCatalogChanges = (
  updates: Array<{ external_id: string; fields: OfficialPreviewField[] }>,
) =>
  adminRequest<OfficialPreviewResponse & { updated: number }>(PATH, {
    method: "POST",
    body: JSON.stringify({ updates }),
  })
