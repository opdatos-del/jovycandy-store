import { NextResponse } from "next/server"

import {
  clearCartId,
  getCart,
  setCompletedOrderCookie,
} from "@/lib/medusa/cart-session"
import { assertSameOrigin, errorResponse } from "@/lib/medusa/http"
import { completeStoreCart, StoreApiError, verifyStorePaymentForCompletion } from "@/lib/medusa/store"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
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

    // Medusa usa el vínculo carrito-pedido para devolver el mismo pedido si
    // el webhook o una solicitud anterior ya completaron este carrito.
    await verifyStorePaymentForCompletion(cart.id)
    const order = await completeStoreCart(cart.id)
    await setCompletedOrderCookie(order)
    await clearCartId()
    return NextResponse.json({ order })
  } catch (error) {
    if (error instanceof StoreApiError && error.status >= 500) {
      return NextResponse.json({ message: "No se pudo verificar el pedido. Vuelve a consultar el estado." }, { status: 503 })
    }
    return errorResponse(error)
  }
}
