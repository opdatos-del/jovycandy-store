import { NextResponse } from "next/server"

import { getCartId } from "@/lib/medusa/cart-session"
import {
  clearCustomerToken,
  getCurrentCustomer,
  setCustomerToken,
} from "@/lib/medusa/customer-session"
import { loginCustomer, transferCartToCustomer } from "@/lib/medusa/customer"
import { assertSameOrigin, errorResponse, requiredString, ValidationError } from "@/lib/medusa/http"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const email = requiredString(body?.email, "correo", 254).toLowerCase()
    const password = requiredString(body?.password, "contraseña", 128)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError("El correo no tiene un formato válido.")
    }
    if (password.length < 8) throw new ValidationError("La contraseña debe tener al menos 8 caracteres.")

    const token = await loginCustomer(email, password)
    const cartId = await getCartId()
    if (cartId) await transferCartToCustomer(cartId, token).catch(() => undefined)
    await setCustomerToken(token)
    const customer = await getCurrentCustomer()
    return NextResponse.json({ customer })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET() {
  const customer = await getCurrentCustomer()
  return NextResponse.json({ customer })
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request)
    await clearCustomerToken()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
