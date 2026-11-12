import { model } from "@medusajs/framework/utils"

const JovyEventAuditLog = model
  .define("jovy_event_audit_log", {
    id: model.id().primaryKey(),
    actor_id: model.text().nullable(),
    entity_id: model.text(),
    action: model.enum(["create", "update", "publish", "unpublish", "archive", "delete", "reorder"]),
    metadata: model.json<Record<string, unknown>>().nullable(),
  })
  .indexes([{ on: ["entity_id", "created_at"] }])

export default JovyEventAuditLog
