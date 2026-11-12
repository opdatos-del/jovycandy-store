import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { JOVY_CONTENT_MODULE } from "@jovy/modules/jovy-content"
import {
  resolvePublishedAt,
  updateEditorialPageSchema,
} from "@jovy/lib/jovy/editorial-page"
import { getAdminActorId } from "@jovy/lib/jovy/audit"
import { updateEditorialPageWorkflow } from "@jovy/workflows/jovy-content/update-editorial-page"
import { deleteEditorialPageWorkflow } from "@jovy/workflows/jovy-content/delete-editorial-page"

async function getPageOrRespond(req: MedusaRequest, res: MedusaResponse) {
  const contentService = req.scope.resolve(JOVY_CONTENT_MODULE)
  const [page] = await contentService.listEditorialPages({ id: req.params.id })

  if (!page) {
    res.status(404).json({ message: "Página editorial no encontrada" })
    return null
  }

  return { contentService, page }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const result = await getPageOrRespond(req, res)
  if (!result) return

  res.json({ page: result.page })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = updateEditorialPageSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "El contenido editorial no es válido",
      errors: parsed.error.flatten(),
    })
  }

  const result = await getPageOrRespond(req, res)
  if (!result) return

  const nextStatus = parsed.data.status ?? result.page.status
  const action =
    nextStatus === "published" && result.page.status !== "published"
      ? "publish"
      : nextStatus === "archived" && result.page.status !== "archived"
        ? "archive"
        : "update"

  const { result: page } = await updateEditorialPageWorkflow(req.scope).run({
    input: {
      id: result.page.id,
      ...parsed.data,
      slug: parsed.data.slug ?? result.page.slug,
      status: nextStatus,
      translations: parsed.data.translations ?? result.page.translations,
      seo: parsed.data.seo ?? result.page.seo ?? undefined,
      published_at: resolvePublishedAt(
        {
          status: nextStatus,
          published_at: parsed.data.published_at,
        },
        result.page.published_at,
      ),
      actor_id: getAdminActorId(req),
      audit_action: action,
    },
  })

  res.json({ page })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const result = await getPageOrRespond(req, res)
  if (!result) return

  await deleteEditorialPageWorkflow(req.scope).run({
    input: {
      id: result.page.id,
      slug: result.page.slug,
      status: result.page.status,
      actor_id: getAdminActorId(req),
    },
  })

  res.status(204).send()
}
