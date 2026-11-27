import { NextResponse } from "next/server"

import { getOrCreateCart } from "@/lib/medusa/cart-session"
import { getCustomerOrder } from "@/lib/medusa/customer"
import { getCustomerToken } from "@/lib/medusa/customer-session"
import { assertSameOrigin, errorResponse, requiredString } from "@/lib/medusa/http"
import { addStoreCartItem, canReorderVariant, StoreApiError } from "@/lib/medusa/store"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Context) {
  try {
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 })
    const order = await getCustomerOrder(token, requiredString((await params).id, "pedido", 100))
    if (!order) return NextResponse.json({ message: "Pedido no encontrado." }, { status: 404 })
    return NextResponse.json({ order })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request)
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 })
    const order = await getCustomerOrder(token, requiredString((await params).id, "pedido", 100))
    if (!order) return NextResponse.json({ message: "Pedido no encontrado." }, { status: 404 })
    if (order.items.length > 100) {
      return NextResponse.json({ message: "Agrega manualmente los productos de este pedido." }, { status: 422 })
    }

    let cart = await getOrCreateCart()
    const skipped: Array<{ id: string; title: string; reason: "unavailable" | "unverified" }> = []
    let added = 0
    for (const item of order.items) {
      const title = [item.title, item.variantTitle].filter(Boolean).join(" · ")
      try {
        if (!item.variantId || !item.productId || !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1 || item.quantity > 99 ||
            !(await canReorderVariant(cart, item.productId, item.variantId, item.quantity))) {
          skipped.push({ id: item.id, title, reason: "unavailable" })
          continue
        }
        cart = await addStoreCartItem(cart.id, item.variantId, item.quantity)
        added += item.quantity
      } catch (error) {
        if (error instanceof StoreApiError && [400, 404, 409, 422].includes(error.status)) {
          skipped.push({ id: item.id, title, reason: "unavailable" })
        } else {
          // Una respuesta perdida no demuestra que Medusa no aplicó la línea.
          // No reintentar; el cliente debe consultar el carrito vigente.
          skipped.push({ id: item.id, title, reason: "unverified" })
        }
      }
    }
    return NextResponse.json({ added, skipped })
  } catch (error) {
    return errorResponse(error)
  }
}
