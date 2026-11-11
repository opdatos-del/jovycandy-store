import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_CONTENT_MODULE } from "@jovy/modules/jovy-content"
import {
  createEditorialPageSchema,
  resolvePublishedAt,
} from "@jovy/lib/jovy/editorial-page"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { createEditorialPageWorkflow } from "@jovy/workflows/jovy-content/create-editorial-page"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function getPagination(query: Record<string, unknown>) {
  const requestedLimit = Number(query.limit)
  const requestedOffset = Number(query.offset)

  return {
    limit: Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT,
    offset: Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const contentService = req.scope.resolve(JOVY_CONTENT_MODULE)
  const { limit, offset } = getPagination(req.query)
  const [pages, count] = await contentService.listAndCountEditorialPages(
    {},
    { take: limit, skip: offset, order: { created_at: "DESC" } },
  )

  res.json({ pages, count, limit, offset })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = createEditorialPageSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "El contenido editorial no es válido",
      errors: parsed.error.flatten(),
    })
  }

  const { result: page } = await createEditorialPageWorkflow(req.scope).run({
    input: {
      ...parsed.data,
      published_at: resolvePublishedAt(parsed.data),
      actor_id: getAdminActorId(req),
      audit_action: "create",
    },
  })

  res.status(201).json({ page })
}
