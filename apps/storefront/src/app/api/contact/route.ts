import { NextResponse } from "next/server"

const BACKEND = (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000").replace(/\/$/, "")
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY ?? ""

const CONTACT_TYPES = new Set(["national-sales", "international-sales", "customer-service", "catalogue"])

export async function POST(request: Request) {
  if (!KEY) {
    return NextResponse.json({ message: "El formulario no está configurado." }, { status: 503 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: "La solicitud no es válida." }, { status: 400 })
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ message: "La solicitud no es válida." }, { status: 400 })
  }

  const body = payload as Record<string, unknown>
  if (typeof body.contact_type !== "string" || !CONTACT_TYPES.has(body.contact_type)) {
    return NextResponse.json({ message: "La solicitud no es válida." }, { status: 400 })
  }

  try {
    const response = await fetch(`${BACKEND}/store/jovy/contacts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-publishable-api-key": KEY,
      },
      body: JSON.stringify(body),
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ message: "No se pudo enviar la solicitud." }, { status: 502 })
  }
}
