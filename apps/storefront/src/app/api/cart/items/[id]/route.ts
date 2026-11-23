import { NextResponse } from "next/server"

import { getCart } from "@/lib/medusa/cart-session"
import { assertSameOrigin, errorResponse, parseQuantity } from "@/lib/medusa/http"
import { removeStoreCartItem, updateStoreCartItem } from "@/lib/medusa/store"

type ItemRouteProps = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: ItemRouteProps) {
  try {
    assertSameOrigin(request)
    const { id } = await params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const quantity = parseQuantity(body?.quantity)
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }
    const updated = await updateStoreCartItem(cart.id, id, quantity)
    return NextResponse.json({ cart: updated })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: ItemRouteProps) {
  try {
    assertSameOrigin(request)
    const { id } = await params
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }
    const updated = await removeStoreCartItem(cart.id, id)
    return NextResponse.json({ cart: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
