import { NextResponse } from "next/server"

import { getCart } from "@/lib/medusa/cart-session"
import { assertSameOrigin, errorResponse } from "@/lib/medusa/http"
import { createStorePaymentSession } from "@/lib/medusa/store"

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
    const updated = await createStorePaymentSession(cart.id)
    return NextResponse.json({ cart: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
