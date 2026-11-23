import { NextResponse } from "next/server"

import { getCart, getOrCreateCart } from "@/lib/medusa/cart-session"
import { errorResponse } from "@/lib/medusa/http"

export async function GET() {
  try {
    const cart = await getCart()
    return NextResponse.json({ cart })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST() {
  try {
    const cart = await getOrCreateCart()
    return NextResponse.json({ cart })
  } catch (error) {
    return errorResponse(error)
  }
}
