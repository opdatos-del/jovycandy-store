import { NextResponse } from "next/server"

import { getCustomerNotices, readCustomerNotice, setMarketingEmail } from "@/lib/medusa/customer"
import { getCustomerToken } from "@/lib/medusa/customer-session"
import { assertSameOrigin, errorResponse, requiredString } from "@/lib/medusa/http"

export async function GET() {
  try {
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 })
    return NextResponse.json(await getCustomerNotices(token))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const token = await getCustomerToken()
    if (!token) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 })
    const body = await request.json().catch(() => null)
    if (body?.action === "set_marketing_email" && typeof body.enabled === "boolean") {
      return NextResponse.json(await setMarketingEmail(token, body.enabled))
    }
    return NextResponse.json(await readCustomerNotice(token, requiredString(body?.id, "notificación", 80)))
  } catch (error) {
    return errorResponse(error)
  }
}
