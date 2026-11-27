import { NextResponse } from "next/server"

import { attachCartOnLogin, clearCartId, clearCompletedOrderCookie } from "@/lib/medusa/cart-session"
import {
  clearCustomerToken,
  getCurrentCustomer,
  getCustomerToken,
  setCustomerToken,
} from "@/lib/medusa/customer-session"
import { loginCustomer, updateCustomerProfile } from "@/lib/medusa/customer"
import { assertSameOrigin, errorResponse, optionalString, requiredString, ValidationError } from "@/lib/medusa/http"

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
    await attachCartOnLogin(token)
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
    await clearCartId()
    await clearCompletedOrderCookie()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request)
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión para editar tu perfil." }, { status: 401 })
    const input = await request.json().catch(() => null)
    const customer = await updateCustomerProfile(token, {
      first_name: requiredString(input?.first_name, "nombre", 80),
      last_name: requiredString(input?.last_name, "apellidos", 120),
      phone: optionalString(input?.phone, 40),
    })
    return NextResponse.json({ customer })
  } catch (error) {
    return errorResponse(error)
  }
}
