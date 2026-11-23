import { NextResponse } from "next/server"

import { getCart } from "@/lib/medusa/cart-session"
import { assertSameOrigin, errorResponse, requiredString } from "@/lib/medusa/http"
import { setStoreCartShippingMethod } from "@/lib/medusa/store"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const optionId = requiredString(body?.option_id, "método de envío", 255)
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }
    const updated = await setStoreCartShippingMethod(cart.id, optionId)
    return NextResponse.json({ cart: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
