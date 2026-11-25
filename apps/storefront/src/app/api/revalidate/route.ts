import { createHmac, timingSafeEqual } from "node:crypto"

import { revalidateTag } from "next/cache"
import type { NextRequest } from "next/server"

const MAX_BODY_BYTES = 4 * 1024
const MAX_CLOCK_SKEW_SECONDS = 300
const ALLOWED_TAGS = new Set(["jovy-content"])

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  })
}

async function readLimitedBody(request: NextRequest): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return null
  }

  if (!request.body) return ""

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(merged)
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")

  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

/**
 * Invalida únicamente las etiquetas editoriales permitidas. La petición debe
 * venir firmada por Medusa con HMAC SHA-256 sobre `timestamp.cuerpo`, dentro de
 * una ventana corta. No acepta revalidación arbitraria ni etiquetas privadas.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.JOVY_REVALIDATION_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return json(503, {
      message: "La revalidación no está configurada en este entorno.",
    })
  }

  const timestamp = request.headers.get("x-jovy-timestamp")?.trim()
  const signature = request.headers.get("x-jovy-signature")?.trim()
  if (!timestamp || !signature) {
    return json(401, { message: "Firma de revalidación requerida." })
  }

  const timestampSeconds = Number(timestamp)
  if (!Number.isFinite(timestampSeconds)) {
    return json(401, { message: "Timestamp de revalidación inválido." })
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return json(401, { message: "Timestamp de revalidación expirado." })
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().includes("application/json")) {
    return json(415, { message: "Se requiere application/json." })
  }

  const body = await readLimitedBody(request)
  if (body === null) {
    return json(413, { message: "El cuerpo de revalidación es demasiado grande." })
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")

  if (!constantTimeEqual(signature, expectedSignature)) {
    return json(401, { message: "Firma de revalidación inválida." })
  }

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return json(400, { message: "El cuerpo de revalidación no es JSON válido." })
  }

  const tagsValue = (payload as { tags?: unknown } | null)?.tags
  if (!Array.isArray(tagsValue) || tagsValue.length === 0) {
    return json(400, { message: "Se requiere al menos una etiqueta." })
  }

  const tags = [
    ...new Set(
      tagsValue.filter(
        (tag): tag is string =>
          typeof tag === "string" && ALLOWED_TAGS.has(tag),
      ),
    ),
  ]

  if (!tags.length) {
    return json(400, { message: "Ninguna etiqueta está permitida." })
  }

  for (const tag of tags) {
    // `expire: 0` fuerza que la siguiente petición espere la revalidación;
    // es la opción documentada para invalidaciones externas por webhook.
    revalidateTag(tag, { expire: 0 })
  }

  return json(202, { revalidated: tags })
}
