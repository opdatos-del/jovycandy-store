import { adminRequest } from "@admin/shared/lib/admin-api"
import { uploadMarketingImage } from "@admin/shared/lib/media"
import type { Launch, LaunchDraft, LaunchSettings, ProductOption } from "./types"

/**
 * Operaciones HTTP de Nuevos Lanzamientos sobre los endpoints existentes del
 * módulo `jovy-launches` y el catálogo de Medusa. No hay endpoints nuevos ni
 * contratos alternativos.
 */

const LAUNCHES_PATH = "/admin/jovy/launches"
const PRODUCTS_PATH = "/admin/products"

/**
 * Carga inicial. Ambas lecturas comparten `Promise.all` para que un fallo de
 * ajustes no muestre una lista sin saber si el color global es el real.
 */
export async function fetchLaunchesAndSettings(): Promise<{
  launches: Launch[]
  settings: LaunchSettings
}> {
  const [launchResult, settingsResult] = await Promise.all([
    adminRequest<{ launches: Launch[] }>(LAUNCHES_PATH),
    adminRequest<{ launch_settings: LaunchSettings }>(`${LAUNCHES_PATH}/settings`),
  ])

  return {
    launches: launchResult.launches,
    settings: settingsResult.launch_settings,
  }
}

/**
 * Nombres y miniaturas de los productos asociados. Un fallo del catálogo no
 * invalida los lanzamientos: la tarjeta cae al id del producto.
 */
export async function fetchProductNames(
  items: Launch[],
): Promise<Record<string, ProductOption>> {
  const ids = [
    ...new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id))),
  ]
  if (ids.length === 0) return {}

  try {
    const params = new URLSearchParams({ limit: String(ids.length) })
    ids.forEach((id) => params.append("id[]", id))
    const result = await adminRequest<{
      products: Array<{ id: string; title: string; thumbnail?: string | null }>
    }>(`${PRODUCTS_PATH}?${params.toString()}`)

    return Object.fromEntries(
      result.products.map((product) => [
        product.id,
        { id: product.id, title: product.title, thumbnail: product.thumbnail ?? null },
      ]),
    )
  } catch {
    return {}
  }
}

/** Buscador del formulario: sólo productos publicados, máximo seis resultados. */
export async function searchPublishedProducts(query: string): Promise<ProductOption[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "12",
    fields: "id,title,thumbnail,status",
  })
  const result = await adminRequest<{
    products: Array<{ id: string; title: string; thumbnail?: string | null; status?: string }>
  }>(`${PRODUCTS_PATH}?${params.toString()}`)

  return result.products
    .filter((product) => product.status === "published")
    .slice(0, 6)
    .map((product) => ({
      id: product.id,
      title: product.title,
      thumbnail: product.thumbnail ?? null,
    }))
}

/** Cuerpo completo del alta/edición; recorta textos y omite campos vacíos. */
export function launchPayload(draft: LaunchDraft, sortOrder: number) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    product_id: draft.product?.id ?? null,
    image_file_id: draft.image_file_id,
    image_url: draft.image_url.trim() || null,
    active: draft.active,
    sort_order: sortOrder,
  }
}

export function createLaunch(draft: LaunchDraft, sortOrder: number) {
  return adminRequest(LAUNCHES_PATH, {
    method: "POST",
    body: JSON.stringify(launchPayload(draft, sortOrder)),
  })
}

export function updateLaunch(id: string, body: Record<string, unknown>) {
  return adminRequest(`${LAUNCHES_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

/** Baja lógica: el archivo de imagen compartido no se borra. */
export function removeLaunch(id: string) {
  return adminRequest(`${LAUNCHES_PATH}/${id}`, { method: "DELETE" })
}

export function reorderLaunches(ids: string[]) {
  return adminRequest(`${LAUNCHES_PATH}/reorder`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

export async function fetchLaunchSettings(): Promise<LaunchSettings> {
  const result = await adminRequest<{ launch_settings: LaunchSettings }>(
    `${LAUNCHES_PATH}/settings`,
  )
  return result.launch_settings
}

export function saveLaunchSettings(backgroundColor: string) {
  return adminRequest(`${LAUNCHES_PATH}/settings`, {
    method: "PUT",
    body: JSON.stringify({ background_color: backgroundColor }),
  })
}

/** Carril de imágenes del CMS: PNG/JPEG/WebP hasta 5 MB. */
export function uploadLaunchImage(file: File) {
  return uploadMarketingImage(file)
}
