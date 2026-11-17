import { MedusaError } from "@medusajs/framework/utils"
import { resolveCommercialMode, type CommercialMode } from "@jovy/lib/jovy/product-editorial"
import type { QueryGraph } from "@jovy/lib/jovy/product-editorial-graph"

/**
 * Resolución de modalidad comercial para los hooks del carrito. Toda la E/S se
 * inyecta para que la regla sea comprobable sin arrancar Medusa. La decisión se
 * toma siempre en servidor: el cliente nunca aporta `product_id` ni metadata.
 */

export type CommercialModeEditorialService = {
  listProductEditorials: (
    filters: Record<string, unknown>,
  ) => Promise<Array<{ product_id: string; commercial_mode?: CommercialMode | null }>>
}

export type CommercialModeDeps = {
  query: QueryGraph
  editorialService: CommercialModeEditorialService
  /** Aviso acotado cuando la tabla editorial aún no existe (arranque/db:migrate). */
  onMissingTable?: (error: unknown) => void
}

function addVariantId(value: unknown, ids: Set<string>): void {
  if (typeof value === "string" && value.trim()) ids.add(value.trim())
}

function addFromItems(items: unknown, ids: Set<string>): void {
  if (!Array.isArray(items)) return
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    addVariantId((item as Record<string, unknown>).variant_id, ids)
  }
}

/**
 * Extrae los `variant_id` de los tres hooks de carrito. Se leen del `input` y
 * del `cart` del servidor; nunca de `metadata` ni de un `product_id` enviado por
 * el cliente. Se agrupan para resolverlos en una sola consulta.
 */
export function extractVariantIds(data: unknown): string[] {
  const ids = new Set<string>()
  if (!data || typeof data !== "object") return []

  const root = data as Record<string, unknown>
  const input = root.input
  if (input && typeof input === "object") {
    const source = input as Record<string, unknown>
    addVariantId(source.variant_id, ids)
    addFromItems(source.items, ids)
    if (source.update && typeof source.update === "object") {
      addVariantId((source.update as Record<string, unknown>).variant_id, ids)
    }
  }

  const cart = root.cart
  if (cart && typeof cart === "object") addFromItems((cart as Record<string, unknown>).items, ids)

  return [...ids]
}

/** Error de esquema de PostgreSQL (o SQLite) por tabla editorial no migrada. */
export function isEditorialTableMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const message = "message" in error && typeof error.message === "string" ? error.message : String(error)
  return message.includes("jovy_product_editorial") && /(does not exist|not exist|undefined table|no such table|42P01)/i.test(message)
}

/** Resuelve cada variante a su producto con una sola consulta al graph. */
export async function resolveVariantProductIds(
  query: QueryGraph,
  variantIds: readonly string[],
): Promise<string[]> {
  if (!variantIds.length) return []
  const { data } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product_id"],
    filters: { id: [...variantIds] },
    pagination: { take: Math.max(variantIds.length, 50), skip: 0 },
  })

  const productIds = new Set<string>()
  for (const variant of data as Array<{ product_id?: string | null }>) {
    if (typeof variant?.product_id === "string" && variant.product_id) productIds.add(variant.product_id)
  }
  return [...productIds]
}

/**
 * Rechaza el carrito si alguna variante resuelve a un producto sin ficha o cuya
 * modalidad efectiva es CATALOG_ONLY. Devuelve `false` cuando la tabla editorial
 * todavía no existe: en ese caso se omite la validación para no romper el
 * arranque ni `db:migrate`. Nunca muta el carrito.
 */
export async function assertVariantsSellable(data: unknown, deps: CommercialModeDeps): Promise<boolean> {
  const variantIds = extractVariantIds(data)
  if (!variantIds.length) return true

  try {
    const productIds = await resolveVariantProductIds(deps.query, variantIds)
    if (!productIds.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "No se pudo resolver el producto de las variantes del carrito; se trata como catálogo informativo",
      )
    }

    const records = await deps.editorialService.listProductEditorials({ product_id: productIds })
    const modes = new Map(
      records.map((record) => [record.product_id, resolveCommercialMode(record.commercial_mode)]),
    )

    for (const productId of productIds) {
      // Producto sin ficha ⇒ CATALOG_ONLY ⇒ rechazo deliberado.
      if (modes.get(productId) !== "SELLABLE") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `El producto ${productId} es de catálogo informativo y no se puede comprar`,
        )
      }
    }
    return true
  } catch (error) {
    if (isEditorialTableMissing(error)) {
      deps.onMissingTable?.(error)
      return false
    }
    throw error
  }
}
