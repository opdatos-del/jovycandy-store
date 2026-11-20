import { model } from "@medusajs/framework/utils"

/** Auditoría administrativa sin secretos ni PII. */
const JovyAuthzAuditLog = model
  .define("jovy_authz_audit_log", {
    id: model.id().primaryKey(),
    actor_id: model.text().nullable(),
    action: model.enum([
      "role_create",
      "role_update",
      "role_delete",
      "policies_replace",
      "user_access_replace",
      "bootstrap",
    ]),
    target_type: model.text(),
    target_id: model.text(),
    metadata: model.json<Record<string, unknown>>().nullable(),
  })
  .indexes([{ on: ["created_at"] }, { on: ["actor_id", "created_at"] }])

export default JovyAuthzAuditLog
