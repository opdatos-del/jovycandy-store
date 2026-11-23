import { NextResponse } from "next/server"

import {
  clearCartId,
  getCart,
  readCompletedOrderCookie,
  setCompletedOrderCookie,
} from "@/lib/medusa/cart-session"
import { assertSameOrigin, errorResponse } from "@/lib/medusa/http"
import { completeStoreCart } from "@/lib/medusa/store"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }
    if (cart.completedAt) {
      const existing = await readCompletedOrderCookie()
      if (existing) return NextResponse.json({ order: existing, duplicate: true })
      return NextResponse.json({ message: "Este carrito ya fue completado." }, { status: 409 })
    }
    if (!cart.items.length) {
      return NextResponse.json({ message: "El carrito está vacío." }, { status: 400 })
    }
    if (!cart.shippingMethodId) {
      return NextResponse.json(
        { message: "Selecciona un método de envío antes de confirmar." },
        { status: 400 },
      )
    }

    const order = await completeStoreCart(cart.id)
    await setCompletedOrderCookie(order)
    await clearCartId()
    return NextResponse.json({ order })
  } catch (error) {
    return errorResponse(error)
  }
}
