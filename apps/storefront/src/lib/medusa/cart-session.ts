import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

import {
  createStoreCart,
  getMexicoRegion,
  getStoreCart,
  type CompletedOrder,
  type StoreCart,
} from "./store"
import { getCustomerToken } from "./customer-session"
import { transferCartToCustomer } from "./customer"

export const CART_COOKIE = "jovy_cart_id"
export const ORDER_COOKIE = "jovy_last_order"

const CART_MAX_AGE = 60 * 60 * 24 * 30
const ORDER_MAX_AGE = 60 * 10

function cookieSecret() {
  const secret = process.env.JOVY_COMMERCE_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error("JOVY_COMMERCE_SECRET es obligatorio en producción.")
  }
  return "jovy-local-commerce-dev-secret"
}

function sign(value: string) {
  return createHmac("sha256", cookieSecret()).update(value).digest("base64url")
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function getCartId() {
  return (await cookies()).get(CART_COOKIE)?.value ?? null
}

export async function setCartId(cartId: string) {
  ;(await cookies()).set(CART_COOKIE, cartId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE,
  })
}

export async function clearCartId() {
  ;(await cookies()).delete(CART_COOKIE)
}

export async function getCart(): Promise<StoreCart | null> {
  const cartId = await getCartId()
  if (!cartId) return null
  return getStoreCart(cartId)
}

export async function getOrCreateCart(): Promise<StoreCart> {
  const current = await getCart()
  if (current && !current.completedAt) return current

  const region = await getMexicoRegion()
  if (!region) {
    throw new Error("La región de compra México/MXN no está configurada.")
  }

  const cart = await createStoreCart(region.id)
  const token = await getCustomerToken()
  if (token) await transferCartToCustomer(cart.id, token).catch(() => undefined)
  await setCartId(cart.id)
  return cart
}

export async function setCompletedOrderCookie(order: CompletedOrder) {
  const payload = Buffer.from(
    JSON.stringify({
      id: order.id,
      displayId: order.displayId,
      email: order.email,
      currencyCode: order.currencyCode,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      items: order.items,
      exp: Date.now() + ORDER_MAX_AGE * 1000,
    }),
  ).toString("base64url")

  ;(await cookies()).set(ORDER_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ORDER_MAX_AGE,
  })
}

export async function readCompletedOrderCookie(): Promise<CompletedOrder | null> {
  const token = (await cookies()).get(ORDER_COOKIE)?.value
  if (!token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      id?: string
      displayId?: number | null
      email?: string | null
      currencyCode?: string
      total?: number
      status?: string
      createdAt?: string | null
      items?: CompletedOrder["items"]
      exp?: number
    }
    if (!parsed.id || !parsed.exp || parsed.exp < Date.now()) return null
    return {
      id: parsed.id,
      displayId: parsed.displayId ?? null,
      email: parsed.email ?? null,
      currencyCode: parsed.currencyCode ?? "mxn",
      total: parsed.total ?? 0,
      status: parsed.status ?? "pending",
      createdAt: parsed.createdAt ?? null,
      items: parsed.items ?? [],
    }
  } catch {
    return null
  }
}
