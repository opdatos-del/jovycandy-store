import "server-only"

import { cookies } from "next/headers"

import { getCustomer, type Customer } from "./customer"
import { StoreApiError } from "./store"

export const CUSTOMER_COOKIE = "jovy_customer_token"
const MAX_AGE = 60 * 60 * 24 * 7

export async function getCustomerToken() {
  return (await cookies()).get(CUSTOMER_COOKIE)?.value ?? null
}

export async function setCustomerToken(token: string) {
  ;(await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  })
}

export async function clearCustomerToken() {
  ;(await cookies()).delete(CUSTOMER_COOKIE)
}

export async function getCurrentCustomer(): Promise<Customer | null> {
  const token = await getCustomerToken()
  if (!token) return null
  try {
    return await getCustomer(token)
  } catch (error) {
    if (error instanceof StoreApiError && error.status === 401) {
      await clearCustomerToken()
      return null
    }
    return null
  }
}
