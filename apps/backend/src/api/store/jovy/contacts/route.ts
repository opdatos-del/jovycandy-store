import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { consumeContactSubmission } from "@jovy/lib/jovy/contact-rate-limit"
import { publicContactSchema } from "@jovy/lib/jovy/contacts"
import { createContactWorkflow } from "@jovy/workflows/jovy-contacts/contact"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = publicContactSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: "La solicitud no es válida", errors: parsed.error.flatten() })
  const ip = req.ip || "unknown"
  if (!consumeContactSubmission(ip)) {
    return res.status(429).json({ message: "No se puede procesar la solicitud en este momento" })
  }
  // Honeypot submissions receive the same generic acknowledgement but are never persisted.
  if (parsed.data.website) return res.status(202).json({ accepted: true })
  const { website: _website, ...input } = parsed.data
  await createContactWorkflow(req.scope).run({ input })
  res.status(202).json({ accepted: true })
}
