import { NextResponse } from "next/server"

import { getOrCreateCart } from "@/lib/medusa/cart-session"
import { changeCustomerList, getCustomerLists } from "@/lib/medusa/customer"
import { getCustomerToken } from "@/lib/medusa/customer-session"
import { assertSameOrigin, errorResponse, requiredString } from "@/lib/medusa/http"
import { addStoreCartItem, canReorderVariant } from "@/lib/medusa/store"

export async function GET() {
  try {
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión para ver tus listas." }, { status: 401 })
    return NextResponse.json(await getCustomerLists(token))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión para guardar productos." }, { status: 401 })
    const input = await request.json().catch(() => null)
    if (input?.action !== "move") return NextResponse.json(await changeCustomerList(token, input))

    const listId = requiredString(input.list_id, "lista", 80)
    const itemId = requiredString(input.item_id, "artículo", 80)
    const { lists } = await getCustomerLists(token)
    const item = lists.find(({ id }) => id === listId)?.items.find(({ id }) => id === itemId)
    if (!item) return NextResponse.json({ message: "Artículo no encontrado." }, { status: 404 })
    const cart = await getOrCreateCart()
    if (!item.variant || !(await canReorderVariant(cart, item.variant.product.id, item.variant.id, 1))) {
      return NextResponse.json({ message: "Esta presentación no está disponible." }, { status: 409 })
    }
    await addStoreCartItem(cart.id, item.variant.id, 1)
    // Si falla el segundo paso, informamos que ya se agregó; nunca se reintenta el alta.
    const removed = await changeCustomerList(token, { action: "remove", list_id: listId, item_id: itemId })
      .then(() => true, () => false)
    return NextResponse.json({ id: itemId, removed })
  } catch (error) {
    return errorResponse(error)
  }
}
