import type { MedusaRequest } from "@medusajs/framework/http"

export type EditorialAuditAction = "create" | "update" | "publish" | "archive" | "delete"

export function getAdminActorId(request: MedusaRequest) {
  const authContext = (request as unknown as { auth_context?: { actor_id?: string } }).auth_context
  return authContext?.actor_id ?? null
}

export function auditPageMutation(
  request: MedusaRequest,
  action: EditorialAuditAction,
  page: { id: string; slug: string; status: string },
) {
  return {
    actor_id: getAdminActorId(request),
    entity_type: "editorial_page",
    entity_id: page.id,
    action,
    metadata: {
      slug: page.slug,
      status: page.status,
    },
  }
}
