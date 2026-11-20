import { adminRequest } from "@admin/shared/lib/admin-api"
import type { EditorialPage, PageDraft, PageListResponse } from "./types"

/**
 * Operaciones HTTP de Contenido Jovy sobre `/admin/jovy/content/pages`.
 * La ruta no cambia: la feature sólo agrupa el cliente y la pantalla.
 */

const PAGES_PATH = "/admin/jovy/content/pages"

export async function fetchPages(): Promise<EditorialPage[]> {
  const result = await adminRequest<PageListResponse>(PAGES_PATH)
  return result.pages
}

export function createPage(draft: PageDraft) {
  return adminRequest(PAGES_PATH, {
    method: "POST",
    body: JSON.stringify(draft),
  })
}

export function updatePage(id: string, draft: PageDraft) {
  return adminRequest(`${PAGES_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(draft),
  })
}

export function deletePage(id: string) {
  return adminRequest(`${PAGES_PATH}/${id}`, { method: "DELETE" })
}
