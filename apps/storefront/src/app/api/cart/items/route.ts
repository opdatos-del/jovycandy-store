import { NextResponse } from "next/server"

import { getOrCreateCart } from "@/lib/medusa/cart-session"
import { assertSameOrigin, errorResponse, parseQuantity, requiredString } from "@/lib/medusa/http"
import { addStoreCartItem } from "@/lib/medusa/store"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const variantId = requiredString(body?.variant_id, "variante", 255)
    const quantity = parseQuantity(body?.quantity ?? 1)

    const cart = await getOrCreateCart()
    const updated = await addStoreCartItem(cart.id, variantId, quantity)
    return NextResponse.json({ cart: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
