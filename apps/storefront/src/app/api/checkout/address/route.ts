import { NextResponse } from "next/server"

import { getCart } from "@/lib/medusa/cart-session"
import { assertSameOrigin, errorResponse, parseAddress } from "@/lib/medusa/http"
import { updateStoreCartCustomer } from "@/lib/medusa/store"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const body = await request.json().catch(() => null)
    const address = parseAddress(body)
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }

    const updated = await updateStoreCartCustomer(cart.id, {
      email: address.email,
      shippingAddress: {
        first_name: address.first_name,
        last_name: address.last_name,
        address_1: address.address_1,
        address_2: address.address_2 ?? "",
        city: address.city,
        province: address.province,
        postal_code: address.postal_code,
        country_code: address.country_code,
        phone: address.phone ?? "",
      },
    })
    return NextResponse.json({ cart: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
