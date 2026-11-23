import { NextResponse } from "next/server"

import { getCustomerToken } from "@/lib/medusa/customer-session"
import { listCustomerOrders } from "@/lib/medusa/customer"
import { errorResponse } from "@/lib/medusa/http"

export async function GET() {
  try {
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ orders: [] })
    const orders = await listCustomerOrders(token)
    return NextResponse.json({ orders })
  } catch (error) {
    return errorResponse(error)
  }
}
