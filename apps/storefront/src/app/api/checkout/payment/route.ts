import { NextResponse } from "next/server"

import { getCart } from "@/lib/medusa/cart-session"
import { getCustomerToken } from "@/lib/medusa/customer-session"
import { assertSameOrigin, errorResponse, requiredString } from "@/lib/medusa/http"
import { prepareStorePayment, StoreApiError } from "@/lib/medusa/store"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }
    if (!cart.shippingMethodId) {
      return NextResponse.json(
        { message: "Selecciona un método de envío antes de continuar." },
        { status: 400 },
      )
    }
    const body = await request.json().catch(() => null)
    const expected = body?.sessionId === undefined
      ? undefined
      : { sessionId: requiredString(body.sessionId, "sesión", 100), cartVersion: requiredString(body.cartVersion, "versión", 64) }
    const payment = await prepareStorePayment(cart.id, await getCustomerToken(), expected)
    return NextResponse.json({ payment }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof StoreApiError && error.status >= 500) {
      return NextResponse.json({ message: "No se pudo preparar el pago." }, { status: 503 })
    }
    return errorResponse(error)
  }
}
