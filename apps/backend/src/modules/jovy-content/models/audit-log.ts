import { model } from "@medusajs/framework/utils"

const AuditLog = model
  .define("jovy_audit_log", {
    id: model.id().primaryKey(),
    actor_id: model.text().nullable(),
    entity_type: model.text(),
    entity_id: model.text(),
    action: model.enum(["create", "update", "publish", "archive", "delete"]),
    metadata: model.json<Record<string, unknown>>().nullable(),
  })
  .indexes([
    {
      on: ["entity_type", "entity_id", "created_at"],
    },
  ])

export default AuditLog
