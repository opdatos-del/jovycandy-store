import { NextResponse } from "next/server"

import { getCart } from "@/lib/medusa/cart-session"
import { errorResponse } from "@/lib/medusa/http"
import { listStoreShippingOptions } from "@/lib/medusa/store"

export async function GET() {
  try {
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }
    const options = await listStoreShippingOptions(cart.id)
    return NextResponse.json({ options })
  } catch (error) {
    return errorResponse(error)
  }
}
