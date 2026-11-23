import { NextResponse } from "next/server"

import { getCustomerToken } from "@/lib/medusa/customer-session"
import { addCustomerAddress } from "@/lib/medusa/customer"
import { assertSameOrigin, errorResponse, parseCustomerAddress } from "@/lib/medusa/http"

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión para guardar direcciones." }, { status: 401 })
    const body = await request.json().catch(() => null)
    const address = parseCustomerAddress(body)
    const created = await addCustomerAddress(token, address)
    return NextResponse.json({ address: created })
  } catch (error) {
    return errorResponse(error)
  }
}
