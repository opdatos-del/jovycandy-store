import { NextResponse } from "next/server"

import { deleteCustomerAddress, updateCustomerAddress } from "@/lib/medusa/customer"
import { getCustomerToken } from "@/lib/medusa/customer-session"
import { assertSameOrigin, errorResponse, parseCustomerAddress, requiredString } from "@/lib/medusa/http"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request)
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 })
    const id = requiredString((await params).id, "dirección", 100)
    const body = await request.json().catch(() => null)
    const changes = body?.is_default_shipping === true
      ? { is_default_shipping: true }
      : parseCustomerAddress(body)
    await updateCustomerAddress(token, id, changes)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request)
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 })
    await deleteCustomerAddress(token, requiredString((await params).id, "dirección", 100))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
