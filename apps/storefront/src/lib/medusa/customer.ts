import "server-only"

import { StoreApiError } from "./store"
import {
  MEDUSA_BACKEND_URL as BACKEND,
  MEDUSA_PUBLISHABLE_API_KEY as PUBLISHABLE_KEY,
} from "./config"

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE"
  body?: unknown
  token?: string
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${BACKEND}${path}`, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(path.startsWith("/store/") ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null
  if (!response.ok) {
    throw new StoreApiError(
      payload?.message ?? payload?.error ?? "No se pudo completar la operación de cuenta.",
      response.status,
    )
  }
  return payload as T
}

export type Customer = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  addresses: CustomerAddress[]
}

export type CustomerAddress = {
  id: string
  first_name: string | null
  last_name: string | null
  address_1: string | null
  address_2: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country_code: string | null
  phone: string | null
  is_default_shipping?: boolean
}

export type CustomerOrder = {
  id: string
  displayId: number | null
  status: string
  total: number
  currencyCode: string
  createdAt: string | null
  paymentStatus: string | null
  fulfillmentStatus: string | null
  items: Array<{
    id: string
    title: string
    variantTitle: string | null
    variantId: string | null
    productId: string | null
    quantity: number
  }>
}

type RawCustomer = {
  id?: string
  email?: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  addresses?: CustomerAddress[] | null
}

function normalizeCustomer(raw: RawCustomer): Customer | null {
  if (!raw.id || !raw.email) return null
  return {
    id: raw.id,
    email: raw.email,
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    phone: raw.phone ?? null,
    addresses: raw.addresses ?? [],
  }
}

export async function loginCustomer(email: string, password: string): Promise<string> {
  const payload = await request<{ token?: string }>("/auth/customer/emailpass", {
    method: "POST",
    body: { email, password },
  })
  if (!payload.token) throw new StoreApiError("Correo o contraseña incorrectos.", 401)
  return payload.token
}

export async function registerCustomer(input: {
  email: string
  password: string
  first_name: string
  last_name: string
}): Promise<string> {
  let token: string
  try {
    const registration = await request<{ token?: string }>("/auth/customer/emailpass/register", {
      method: "POST",
      body: { email: input.email, password: input.password },
    })
    if (!registration.token) throw new StoreApiError("No se pudo crear la cuenta.", 400)
    token = registration.token
  } catch (error) {
    if (!(error instanceof StoreApiError) || error.status !== 401) throw error
    token = await loginCustomer(input.email, input.password)
  }

  await request("/store/customers", {
    method: "POST",
    token,
    body: { email: input.email, first_name: input.first_name, last_name: input.last_name },
  })
  return loginCustomer(input.email, input.password)
}

export async function getCustomer(token: string): Promise<Customer | null> {
  const payload = await request<{ customer?: RawCustomer }>("/store/customers/me", { token })
  return normalizeCustomer(payload.customer ?? {})
}

type CustomerOrdersPage = { orders: CustomerOrder[]; count: number; offset: number; limit: number }

/** Incluso con ID, se consulta el listado cuyo filtro por cliente aplica Medusa. */
export async function listCustomerOrders(
  token: string,
  { offset = 0, limit = 10, id }: { offset?: number; limit?: number; id?: string } = {},
): Promise<CustomerOrdersPage> {
  type RawOrder = {
    id?: string
    display_id?: number | null
    status?: string | null
    total?: number | null
    currency_code?: string | null
    created_at?: string | null
    payment_status?: string | null
    fulfillment_status?: string | null
    items?: Array<{
      id?: string
      title?: string
      product_title?: string | null
      variant_title?: string | null
      variant_id?: string | null
      product_id?: string | null
      quantity?: number
    }> | null
  }
  const search = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    order: "-created_at",
    fields: "+*items,+payment_status,+fulfillment_status",
    ...(id ? { id } : {}),
  })
  const payload = await request<{ orders?: RawOrder[]; count?: number }>(`/store/orders?${search}`, { token })
  const orders = (payload.orders ?? [])
    .filter((order): order is RawOrder & { id: string } => Boolean(order.id))
    .map((order) => ({
      id: order.id,
      displayId: order.display_id ?? null,
      status: order.status ?? "pending",
      total: order.total ?? 0,
      currencyCode: order.currency_code ?? "mxn",
      createdAt: order.created_at ?? null,
      paymentStatus: order.payment_status ?? null,
      fulfillmentStatus: order.fulfillment_status ?? null,
      items: (order.items ?? []).flatMap((item) => item.id ? [{
        id: item.id,
        title: item.product_title ?? item.title ?? "",
        variantTitle: item.variant_title ?? null,
        variantId: item.variant_id ?? null,
        productId: item.product_id ?? null,
        quantity: item.quantity ?? 0,
      }] : []),
    }))
  return { orders, count: payload.count ?? orders.length, offset, limit }
}

export async function getCustomerOrder(token: string, id: string) {
  const { orders } = await listCustomerOrders(token, { id, limit: 1 })
  return orders.find((order) => order.id === id) ?? null
}

export async function updateCustomerProfile(
  token: string,
  body: { first_name: string; last_name: string; phone: string },
) {
  const payload = await request<{ customer?: RawCustomer }>("/store/customers/me", {
    method: "POST", token, body,
  })
  return normalizeCustomer(payload.customer ?? {})
}

export async function addCustomerAddress(
  token: string,
  address: Record<string, string>,
): Promise<CustomerAddress | null> {
  const payload = await request<{ customer?: RawCustomer }>("/store/customers/me/addresses", {
    method: "POST",
    token,
    body: address,
  })
  const customer = normalizeCustomer(payload.customer ?? {})
  return customer?.addresses.at(-1) ?? null
}

export async function transferCartToCustomer(cartId: string, token: string) {
  await request(`/store/carts/${encodeURIComponent(cartId)}/customer`, {
    method: "POST",
    token,
    body: {},
  })
}

export async function updateCustomerAddress(
  token: string,
  id: string,
  address: Record<string, string | boolean>,
) {
  await request(`/store/customers/me/addresses/${encodeURIComponent(id)}`, {
    method: "POST", token, body: address,
  })
}

export async function deleteCustomerAddress(token: string, id: string) {
  await request(`/store/customers/me/addresses/${encodeURIComponent(id)}`, { method: "DELETE", token })
}

export type CustomerList = {
  id: string
  name: string | null
  items: Array<{
    id: string
    variant: { id: string; title: string; product: { id: string; title: string; handle: string } } | null
  }>
}

export type CustomerNotice = {
  id: string
  kind: "order_placed" | "order_canceled"
  created_at: string
  read_at: string | null
}

export function getCustomerLists(token: string) {
  return request<{ lists: CustomerList[] }>("/store/jovy/customer-lists", { token })
}

export function changeCustomerList(token: string, body: unknown) {
  return request<{ id: string }>("/store/jovy/customer-lists", { token, method: "POST", body })
}

export function getCustomerNotices(token: string) {
  return request<{ notices: CustomerNotice[]; marketingEmail: boolean }>("/store/jovy/customer-notices", { token })
}

export function readCustomerNotice(token: string, id: string) {
  return request<{ id: string }>("/store/jovy/customer-notices", { token, method: "POST", body: { action: "read", id } })
}

export function setMarketingEmail(token: string, enabled: boolean) {
  return request<{ marketingEmail: boolean }>("/store/jovy/customer-notices", {
    token, method: "POST", body: { action: "set_marketing_email", enabled },
  })
}
