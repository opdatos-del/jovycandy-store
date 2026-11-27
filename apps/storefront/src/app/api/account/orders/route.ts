import { NextResponse } from "next/server"

import { getCustomerToken } from "@/lib/medusa/customer-session"
import { listCustomerOrders } from "@/lib/medusa/customer"
import { errorResponse, ValidationError } from "@/lib/medusa/http"

export async function GET(request: Request) {
  try {
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ orders: [], count: 0, offset: 0, limit: 10 })
    const query = new URL(request.url).searchParams
    const offset = Number(query.get("offset") ?? 0)
    if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) {
      throw new ValidationError("Página de pedidos inválida.")
    }
    return NextResponse.json(await listCustomerOrders(token, { offset }))
  } catch (error) {
    return errorResponse(error)
  }
}
