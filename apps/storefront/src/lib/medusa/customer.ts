import "server-only"

import { StoreApiError } from "./store"

const BACKEND = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000").replace(
  /\/$/,
  "",
)
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY ?? ""

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
}

export type CustomerOrder = {
  id: string
  displayId: number | null
  status: string
  total: number
  currencyCode: string
  createdAt: string | null
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

export async function listCustomerOrders(token: string): Promise<CustomerOrder[]> {
  type RawOrder = {
    id?: string
    display_id?: number | null
    status?: string | null
    total?: number | null
    currency_code?: string | null
    created_at?: string | null
  }
  const payload = await request<{ orders?: RawOrder[] }>("/store/orders?limit=50", { token })
  return (payload.orders ?? [])
    .filter((order): order is RawOrder & { id: string } => Boolean(order.id))
    .map((order) => ({
      id: order.id,
      displayId: order.display_id ?? null,
      status: order.status ?? "pending",
      total: order.total ?? 0,
      currencyCode: order.currency_code ?? "mxn",
      createdAt: order.created_at ?? null,
    }))
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
