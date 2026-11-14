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

export type ContactAuditAction = "create" | "status" | "note" | "delete" | "restore" | "update"

/**
 * Only non-identifying operational fields; message, email, phone and notes stay
 * out. `fields` lists the column names that changed, never their values.
 */
export type ContactAuditMetadata = { contact_type?: string; status?: string; fields?: string[] }

/**
 * Whitelists the audit payload for contact requests. It takes the whole record so
 * callers cannot accidentally forward personal data into the audit log.
 */
export function contactAuditMetadata(
  action: ContactAuditAction,
  contact: { status?: string | null; contact_type?: string | null },
  fields: readonly string[] = [],
): ContactAuditMetadata | undefined {
  if (action === "create") {
    return {
      contact_type: contact.contact_type ?? undefined,
      status: contact.status ?? undefined,
    }
  }
  if (action === "status" || action === "delete" || action === "restore") {
    return { status: contact.status ?? undefined }
  }
  if (action === "update") {
    // Unknown or empty field lists are not worth an audit entry.
    return fields.length > 0 ? { fields: [...fields].sort() } : undefined
  }
  return undefined
}
