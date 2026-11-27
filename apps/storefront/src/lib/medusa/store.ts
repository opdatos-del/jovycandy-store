import "server-only"

import { sortByWeight } from "@/lib/commerce/weight"
import {
  parseCardVisualOverrides,
  type CardVisualOverrides,
} from "@/lib/commerce/card-visual"
import {
  MEDUSA_BACKEND_URL as BACKEND,
  MEDUSA_PUBLISHABLE_API_KEY as PUBLISHABLE_KEY,
} from "@/lib/medusa/config"

/**
 * Cliente de lectura/escritura contra la Store API de Medusa.
 * Vive solo en servidor: la publishable key no es un secreto administrativo,
 * pero el carrito y las mutaciones siempre pasan por el BFF con cookie HttpOnly.
 */

const TIMEOUT_MS = 8_000

export class StoreApiError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = "StoreApiError"
    this.status = status
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE"
  body?: unknown
  cache?: RequestCache
}

async function storeFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const method = options.method ?? "GET"

  try {
    const response = await fetch(`${BACKEND}/store${path}`, {
      method,
      headers: {
        "x-publishable-api-key": PUBLISHABLE_KEY,
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: options.cache ?? "no-store",
    })

    const payload = (await response.json().catch(() => null)) as
      | { message?: string; error?: string; type?: string }
      | null

    if (!response.ok) {
      const message =
        payload?.message ??
        payload?.error ??
        (response.status === 404
          ? "El recurso no está disponible."
          : "No se pudo completar la operación comercial.")
      throw new StoreApiError(message, response.status)
    }

    return payload as T
  } catch (error) {
    if (error instanceof StoreApiError) throw error
    if (error instanceof Error && error.name === "AbortError") {
      throw new StoreApiError("La tienda tardó demasiado en responder.", 504)
    }
    throw new StoreApiError("No se pudo conectar con la tienda.", 503)
  } finally {
    clearTimeout(timeout)
  }
}

export type StoreRegion = {
  id: string
  name: string
  currency_code: string
}

export type CommerceVariant = {
  id: string
  title: string
  sku: string | null
  grams: number | null
  manageInventory: boolean
  allowBackorder: boolean
  inventoryQuantity: number | null
  price: number | null
  originalPrice: number | null
  onSale: boolean
  currencyCode: string | null
}

export type CommerceCategory = {
  id: string
  handle: string
  name: string
}

export type CommerceCollection = {
  id: string
  handle: string
  title: string
}

export type CommerceProduct = {
  id: string
  externalId: string | null
  handle: string
  title: string
  description: string | null
  thumbnail: string | null
  images: string[]
  specs: Array<{ label: string; value: string }>
  categories: CommerceCategory[]
  collection: CommerceCollection | null
  variants: CommerceVariant[]
  cardVisual: CardVisualOverrides | null
}

type RawVariant = {
  id?: string
  title?: string | null
  sku?: string | null
  weight?: number | null
  metadata?: Record<string, unknown> | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_quantity?: number | null
  calculated_price?: {
    calculated_amount?: number | null
    original_amount?: number | null
    currency_code?: string | null
    calculated_price?: { price_list_type?: string | null } | null
  } | null
}

type RawProduct = {
  id?: string
  external_id?: string | null
  handle?: string | null
  title?: string | null
  description?: string | null
  thumbnail?: string | null
  images?: Array<{ url?: string | null }> | null
  metadata?: Record<string, unknown> | null
  categories?: Array<{ id?: string; handle?: string; name?: string }> | null
  collection?: { id?: string; handle?: string; title?: string } | null
  variants?: RawVariant[] | null
}

const PRODUCT_FIELDS =
  "id,external_id,title,description,handle,thumbnail,images.url,metadata,categories.id,categories.handle,categories.name,collection.id,collection.handle,collection.title,variants.id,variants.title,variants.sku,variants.weight,variants.metadata,variants.manage_inventory,variants.allow_backorder,variants.inventory_quantity,variants.calculated_price"

function normalizeSpecs(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return []
  return value.filter(
    (spec): spec is { label: string; value: string } =>
      Boolean(
        spec &&
          typeof spec === "object" &&
          typeof (spec as { label?: unknown }).label === "string" &&
          typeof (spec as { value?: unknown }).value === "string",
      ),
  )
}

/**
 * Proyección pública de `product.metadata` para el visual de tarjetas.
 * La validación vive en `lib/commerce/card-visual`; aquí solo se normaliza el
 * producto comercial.
 */
function normalizeProduct(raw: RawProduct): CommerceProduct | null {
  if (!raw.id || !raw.handle || !raw.title) return null

  const variants = sortByWeight(
    (raw.variants ?? [])
      .filter((variant): variant is RawVariant & { id: string } => Boolean(variant.id))
      .map((variant) => ({
        id: variant.id,
        title: variant.title ?? "",
        sku: variant.sku ?? null,
        grams: typeof variant.weight === "number" ? variant.weight : null,
        manageInventory: Boolean(variant.manage_inventory),
        allowBackorder: Boolean(variant.allow_backorder),
        inventoryQuantity:
          typeof variant.inventory_quantity === "number" ? variant.inventory_quantity : null,
        price:
          typeof variant.calculated_price?.calculated_amount === "number"
            ? variant.calculated_price.calculated_amount
            : null,
        originalPrice:
          typeof variant.calculated_price?.original_amount === "number"
            ? variant.calculated_price.original_amount
            : null,
        onSale:
          variant.calculated_price?.calculated_price?.price_list_type === "sale" &&
          typeof variant.calculated_price?.original_amount === "number" &&
          typeof variant.calculated_price?.calculated_amount === "number" &&
          variant.calculated_price.original_amount > variant.calculated_price.calculated_amount,
        currencyCode: variant.calculated_price?.currency_code ?? null,
      })),
  )

  const images = [
    ...new Set(
      [
        ...(raw.images ?? []).map((image) => image.url).filter((url): url is string => Boolean(url)),
        raw.thumbnail ?? null,
      ].filter((url): url is string => Boolean(url)),
    ),
  ]

  return {
    id: raw.id,
    externalId: raw.external_id ?? null,
    handle: raw.handle,
    title: raw.title,
    description: raw.description ?? null,
    thumbnail: raw.thumbnail ?? null,
    images,
    // Compatibilidad temporal de lectura con productos importados antes del
    // cambio de nombre. La importación nueva escribe `jovy_legacy_specs`.
    specs: normalizeSpecs(
      raw.metadata?.jovy_specs ??
        raw.metadata?.jovy_legacy_specs ??
        raw.metadata?.jovy_official_specs,
    ),
    categories: (raw.categories ?? [])
      .filter(
        (category): category is { id: string; handle: string; name: string } =>
          Boolean(category.id && category.handle && category.name),
      )
      .map((category) => ({
        id: category.id,
        handle: category.handle,
        name: category.name,
      })),
    collection:
      raw.collection?.id && raw.collection.handle && raw.collection.title
        ? {
            id: raw.collection.id,
            handle: raw.collection.handle,
            title: raw.collection.title,
          }
        : null,
    variants,
    cardVisual: parseCardVisualOverrides(raw.metadata),
  }
}

export async function getMexicoRegion(): Promise<StoreRegion | null> {
  const payload = await storeFetch<{ regions?: StoreRegion[] }>("/regions", {
    cache: "force-cache",
  })
  return (
    payload.regions?.find((region) => region.currency_code === "mxn" || region.name === "Mexico") ??
    null
  )
}

export async function listCommerceProducts(regionId: string): Promise<CommerceProduct[]> {
  const products: RawProduct[] = []
  const limit = 100
  let offset = 0

  while (true) {
    const payload = await storeFetch<{
      products?: RawProduct[]
      count?: number
    }>(
      `/products?region_id=${encodeURIComponent(regionId)}&limit=${limit}&offset=${offset}&fields=${PRODUCT_FIELDS}`,
    )
    const page = payload.products ?? []
    products.push(...page)
    offset += page.length

    if (
      page.length < limit ||
      (typeof payload.count === "number" && products.length >= payload.count)
    ) {
      break
    }
  }

  return products
    .map(normalizeProduct)
    .filter((product): product is CommerceProduct => Boolean(product))
}

type RawCategoryList = {
  product_categories?: Array<{ id?: string; handle?: string; name?: string }>
  count?: number
}

type RawCollectionList = {
  collections?: Array<{ id?: string; handle?: string; title?: string }>
  count?: number
}

/**
 * Las APIs de categorías y colecciones tienen paginación propia. Se recorren
 * todas las páginas para que la navegación no dependa de un límite fijo.
 */
export async function listCommerceCategories(): Promise<CommerceCategory[]> {
  const limit = 100
  const rows: Array<{ id?: string; handle?: string; name?: string }> = []
  let offset = 0

  while (true) {
    const payload = await storeFetch<RawCategoryList>(
      `/product-categories?limit=${limit}&offset=${offset}&fields=id,handle,name`,
    )
    const page = payload.product_categories ?? []
    rows.push(...page)
    offset += page.length
    if (
      page.length < limit ||
      (typeof payload.count === "number" && rows.length >= payload.count)
    ) {
      break
    }
  }

  return rows
    .filter(
      (category): category is { id: string; handle: string; name: string } =>
        Boolean(category.id && category.handle && category.name),
    )
    .map((category) => ({
      id: category.id,
      handle: category.handle,
      name: category.name,
    }))
}

export async function listCommerceCollections(): Promise<CommerceCollection[]> {
  const limit = 100
  const rows: Array<{ id?: string; handle?: string; title?: string }> = []
  let offset = 0

  while (true) {
    const payload = await storeFetch<RawCollectionList>(
      `/collections?limit=${limit}&offset=${offset}&fields=id,handle,title`,
    )
    const page = payload.collections ?? []
    rows.push(...page)
    offset += page.length
    if (
      page.length < limit ||
      (typeof payload.count === "number" && rows.length >= payload.count)
    ) {
      break
    }
  }

  return rows
    .filter(
      (collection): collection is { id: string; handle: string; title: string } =>
        Boolean(collection.id && collection.handle && collection.title),
    )
    .map((collection) => ({
      id: collection.id,
      handle: collection.handle,
      title: collection.title,
    }))
}

export async function getCommerceProduct(
  handle: string,
  regionId: string,
): Promise<CommerceProduct | null> {
  const payload = await storeFetch<{ products?: RawProduct[] }>(
    `/products?handle=${encodeURIComponent(handle)}&region_id=${encodeURIComponent(regionId)}&fields=${PRODUCT_FIELDS}`,
  )
  const product = payload.products?.[0]
  return product ? normalizeProduct(product) : null
}

export type StoreCartItem = {
  id: string
  variantId: string | null
  productHandle: string | null
  productTitle: string
  variantTitle: string
  thumbnail: string | null
  quantity: number
  unitPrice: number
  total: number
  discountTotal: number
}

export type StorePromotion = {
  id: string
  code: string
  isAutomatic: boolean
}

export type StoreCart = {
  id: string
  regionId: string | null
  currencyCode: string
  email: string | null
  items: StoreCartItem[]
  itemCount: number
  subtotal: number
  shippingTotal: number
  taxTotal: number
  discountTotal: number
  total: number
  promotions: StorePromotion[]
  shippingMethodId: string | null
  completedAt: string | null
}

type RawLineItem = {
  id?: string
  variant_id?: string | null
  product_handle?: string | null
  product_title?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  quantity?: number | null
  unit_price?: number | null
  total?: number | null
  discount_total?: number | null
}

type RawPromotion = {
  id?: string
  code?: string | null
  is_automatic?: boolean | null
}

type RawCart = {
  id?: string
  region_id?: string | null
  currency_code?: string | null
  email?: string | null
  shipping_address?: { first_name?: string | null } | null
  items?: RawLineItem[] | null
  subtotal?: number | null
  shipping_total?: number | null
  tax_total?: number | null
  discount_total?: number | null
  total?: number | null
  promotions?: RawPromotion[] | null
  shipping_methods?: Array<{ id?: string | null }> | null
  completed_at?: string | null
}

export function normalizeCart(raw: RawCart): StoreCart | null {
  if (!raw.id) return null
  const items = (raw.items ?? [])
    .filter((item): item is RawLineItem & { id: string } => Boolean(item.id))
    .map((item) => {
      const quantity = typeof item.quantity === "number" ? item.quantity : 0
      const unitPrice = typeof item.unit_price === "number" ? item.unit_price : 0
      const gross = unitPrice * quantity
      const discountTotal =
        typeof item.discount_total === "number" ? item.discount_total : 0
      return {
        id: item.id,
        variantId: item.variant_id ?? null,
        productHandle: item.product_handle ?? null,
        productTitle: item.product_title ?? "Producto",
        variantTitle: item.variant_title ?? "",
        thumbnail: item.thumbnail ?? null,
        quantity,
        unitPrice,
        total: typeof item.total === "number" ? item.total : gross - discountTotal,
        discountTotal,
      }
    })

  return {
    id: raw.id,
    regionId: raw.region_id ?? null,
    currencyCode: raw.currency_code ?? "mxn",
    email: raw.email ?? null,
    items,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotal: raw.subtotal ?? 0,
    shippingTotal: raw.shipping_total ?? 0,
    taxTotal: raw.tax_total ?? 0,
    discountTotal: raw.discount_total ?? 0,
    total: raw.total ?? 0,
    promotions: (raw.promotions ?? [])
      .filter((promotion): promotion is RawPromotion & { code: string } =>
        Boolean(promotion.code),
      )
      .map((promotion) => ({
        id: promotion.id ?? promotion.code,
        code: promotion.code,
        isAutomatic: Boolean(promotion.is_automatic),
      })),
    shippingMethodId: raw.shipping_methods?.[0]?.id ?? null,
    completedAt: raw.completed_at ?? null,
  }
}

export async function createStoreCart(regionId: string): Promise<StoreCart> {
  const payload = await storeFetch<{ cart?: RawCart }>("/carts", {
    method: "POST",
    body: { region_id: regionId },
  })
  const cart = normalizeCart(payload.cart ?? {})
  if (!cart) throw new StoreApiError("No se pudo crear el carrito.")
  return cart
}

export async function getStoreCart(cartId: string): Promise<StoreCart | null> {
  try {
    const payload = await storeFetch<{ cart?: RawCart }>(`/carts/${encodeURIComponent(cartId)}`)
    return normalizeCart(payload.cart ?? {})
  } catch (error) {
    if (error instanceof StoreApiError && error.status === 404) return null
    throw error
  }
}

export async function addStoreCartItem(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<StoreCart> {
  const payload = await storeFetch<{ cart?: RawCart }>(
    `/carts/${encodeURIComponent(cartId)}/line-items`,
    {
      method: "POST",
      body: { variant_id: variantId, quantity },
    },
  )
  const cart = normalizeCart(payload.cart ?? {})
  if (!cart) throw new StoreApiError("No se pudo actualizar el carrito.")
  return cart
}

export async function updateStoreCartItem(
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<StoreCart> {
  const payload = await storeFetch<{ cart?: RawCart }>(
    `/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(itemId)}`,
    {
      method: "POST",
      body: { quantity },
    },
  )
  const cart = normalizeCart(payload.cart ?? {})
  if (!cart) throw new StoreApiError("No se pudo actualizar el carrito.")
  return cart
}

export async function removeStoreCartItem(cartId: string, itemId: string): Promise<StoreCart> {
  // El Store API de Medusa responde con un resultado de borrado, no con el
  // carrito actualizado: el estado se relee para reconstruir totales reales.
  await storeFetch<{ id?: string; deleted?: boolean }>(
    `/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  )
  const cart = await getStoreCart(cartId)
  if (!cart) throw new StoreApiError("No se pudo actualizar el carrito.")
  return cart
}

/**
 * Medusa es la autoridad del descuento: el storefront solo envía el código y
 * vuelve a leer el carrito con sus totales y ajustes calculados.
 */
export async function applyStoreCartPromotion(
  cartId: string,
  code: string,
): Promise<StoreCart> {
  const payload = await storeFetch<{ cart?: RawCart }>(
    `/carts/${encodeURIComponent(cartId)}/promotions`,
    { method: "POST", body: { promo_codes: [code] } },
  )
  const cart = normalizeCart(payload.cart ?? {})
  if (!cart) throw new StoreApiError("No se pudo aplicar el cupón.")
  // Medusa puede aceptar la petición y no conceder nada si el código no es
  // elegible. El cliente debe ver un resultado honesto, no un falso positivo.
  if (!cart.promotions.some((promotion) => promotion.code.toUpperCase() === code.toUpperCase())) {
    throw new StoreApiError("El cupón no es válido o ya no está vigente.", 422)
  }
  return cart
}

export async function removeStoreCartPromotion(
  cartId: string,
  code: string,
): Promise<StoreCart> {
  const payload = await storeFetch<{ cart?: RawCart }>(
    `/carts/${encodeURIComponent(cartId)}/promotions`,
    { method: "DELETE", body: { promo_codes: [code] } },
  )
  const cart = normalizeCart(payload.cart ?? {})
  if (!cart) throw new StoreApiError("No se pudo retirar el cupón.")
  return cart
}

export type ShippingOption = {
  id: string
  name: string
  amount: number
  currencyCode: string
}

export async function listStoreShippingOptions(cartId: string): Promise<ShippingOption[]> {
  type RawShippingOption = {
    id?: string
    name?: string
    amount?: number | null
    calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null
  }
  const payload = await storeFetch<{ shipping_options?: RawShippingOption[] }>(
    `/shipping-options?cart_id=${encodeURIComponent(cartId)}`,
  )

  return (payload.shipping_options ?? [])
    .filter((option): option is RawShippingOption & { id: string } => Boolean(option.id))
    .map((option) => ({
      id: option.id,
      name: option.name ?? "Envío",
      amount: option.calculated_price?.calculated_amount ?? option.amount ?? 0,
      currencyCode: option.calculated_price?.currency_code ?? "mxn",
    }))
}

export async function setStoreCartShippingMethod(
  cartId: string,
  optionId: string,
): Promise<StoreCart> {
  const payload = await storeFetch<{ cart?: RawCart }>(
    `/carts/${encodeURIComponent(cartId)}/shipping-methods`,
    { method: "POST", body: { option_id: optionId } },
  )
  const cart = normalizeCart(payload.cart ?? {})
  if (!cart) throw new StoreApiError("No se pudo seleccionar el envío.")
  return cart
}

export async function updateStoreCartCustomer(
  cartId: string,
  input: {
    email: string
    shippingAddress: Record<string, string>
    regionId?: string | null
  },
): Promise<StoreCart> {
  const body = {
    // Enviar la región evita que el workflow de Medusa trate la actualización
    // como un cambio de región y reemplace la dirección por solo el país.
    ...(input.regionId ? { region_id: input.regionId } : {}),
    email: input.email,
    shipping_address: input.shippingAddress,
    billing_address: input.shippingAddress,
  }

  const send = () =>
    storeFetch<{ cart?: RawCart }>(`/carts/${encodeURIComponent(cartId)}`, {
      method: "POST",
      body,
    })

  let payload = await send()
  // En Medusa 2.22, la primera actualización de un carrito recién creado puede
  // dejar solo `country_code` si el workflow interpreta la operación como un
  // cambio de región. Se relee el carrito persistido y, solo si la dirección
  // quedó incompleta, se repite la escritura completa.
  const persisted = await storeFetch<{ cart?: RawCart }>(
    `/carts/${encodeURIComponent(cartId)}`,
  )
  if (!persisted.cart?.shipping_address?.first_name) {
    payload = await send()
  }

  const cart = normalizeCart(payload.cart ?? {})
  if (!cart) throw new StoreApiError("No se pudieron guardar los datos de envío.")
  return cart
}

export async function createStorePaymentSession(cartId: string): Promise<StoreCart> {
  const paymentCollection = await storeFetch<{ payment_collection?: { id?: string } }>(
    "/payment-collections",
    { method: "POST", body: { cart_id: cartId } },
  )
  const collectionId = paymentCollection.payment_collection?.id
  if (!collectionId) throw new StoreApiError("No se pudo preparar el pago de laboratorio.")

  await storeFetch(`/payment-collections/${encodeURIComponent(collectionId)}/payment-sessions`, {
    method: "POST",
    body: { provider_id: "pp_system_default" },
  })

  const cart = await getStoreCart(cartId)
  if (!cart) throw new StoreApiError("No se pudo recuperar el carrito.")
  return cart
}

export type CompletedOrder = {
  id: string
  displayId: number | null
  email: string | null
  currencyCode: string
  subtotal: number
  shippingTotal: number
  discountTotal: number
  total: number
  status: string
  createdAt: string | null
  items: Array<{
    title: string
    variantTitle: string
    quantity: number
    total: number
    thumbnail: string | null
  }>
}

type RawOrder = {
  id?: string
  display_id?: number | null
  email?: string | null
  currency_code?: string | null
  subtotal?: number | null
  shipping_total?: number | null
  discount_total?: number | null
  total?: number | null
  status?: string | null
  created_at?: string | null
  items?: Array<{
    title?: string | null
    variant_title?: string | null
    quantity?: number | null
    total?: number | null
    thumbnail?: string | null
    unit_price?: number | null
  }> | null
}

export function normalizeOrder(raw: RawOrder): CompletedOrder | null {
  if (!raw.id) return null
  return {
    id: raw.id,
    displayId: raw.display_id ?? null,
    email: raw.email ?? null,
    currencyCode: raw.currency_code ?? "mxn",
    subtotal: raw.subtotal ?? 0,
    shippingTotal: raw.shipping_total ?? 0,
    discountTotal: raw.discount_total ?? 0,
    total: raw.total ?? 0,
    status: raw.status ?? "pending",
    createdAt: raw.created_at ?? null,
    items: (raw.items ?? []).map((item) => ({
      title: item.title ?? "Producto",
      variantTitle: item.variant_title ?? "",
      quantity: item.quantity ?? 0,
      total: item.total ?? (item.unit_price ?? 0) * (item.quantity ?? 0),
      thumbnail: item.thumbnail ?? null,
    })),
  }
}

export async function completeStoreCart(cartId: string): Promise<CompletedOrder> {
  const payload = await storeFetch<{
    type?: string
    order?: RawOrder
    error?: { message?: string } | null
  }>(`/carts/${encodeURIComponent(cartId)}/complete`, { method: "POST", body: {} })

  if (payload.type !== "order" || !payload.order) {
    throw new StoreApiError(
      payload.error?.message ?? "No se pudo completar el pedido. Revisa el carrito e intenta de nuevo.",
      409,
    )
  }

  const order = normalizeOrder(payload.order)
  if (!order) throw new StoreApiError("La orden no devolvió datos válidos.")
  return order
}
