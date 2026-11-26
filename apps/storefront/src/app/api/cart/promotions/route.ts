import { NextResponse } from "next/server"

import { getCart } from "@/lib/medusa/cart-session"
import { assertSameOrigin, errorResponse, requiredString } from "@/lib/medusa/http"
import {
  applyStoreCartPromotion,
  removeStoreCartPromotion,
} from "@/lib/medusa/store"

async function readCode(request: Request) {
  assertSameOrigin(request)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  return requiredString(body?.code, "cupón", 64).toUpperCase()
}

export async function POST(request: Request) {
  try {
    const code = await readCode(request)
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }
    const updated = await applyStoreCartPromotion(cart.id, code)
    return NextResponse.json({ cart: updated })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const code = await readCode(request)
    const cart = await getCart()
    if (!cart) {
      return NextResponse.json({ message: "No hay un carrito activo." }, { status: 404 })
    }
    const updated = await removeStoreCartPromotion(cart.id, code)
    return NextResponse.json({ cart: updated })
  } catch (error) {
    return errorResponse(error)
  }
}
