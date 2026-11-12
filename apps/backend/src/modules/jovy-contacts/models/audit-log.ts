import { model } from "@medusajs/framework/utils"

export default model
  .define("jovy_contact_audit_log", {
    id: model.id().primaryKey(),
    actor_id: model.text().nullable(),
    contact_request_id: model.text(),
    action: model.enum(["create", "status", "note", "delete"]),
    metadata: model.json<Record<string, unknown>>().nullable(),
  })
  .indexes([{ on: ["contact_request_id", "created_at"] }])
