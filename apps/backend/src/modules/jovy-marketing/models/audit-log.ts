import { model } from "@medusajs/framework/utils"

const MarketingAuditLog = model
  .define("jovy_marketing_audit_log", {
    id: model.id().primaryKey(),
    actor_id: model.text().nullable(),
    entity_type: model.enum(["hero_item", "hero_settings", "marketing_banner"]),
    entity_id: model.text(),
    action: model.enum(["create", "update", "publish", "unpublish", "archive", "delete", "reorder"]),
    metadata: model.json<Record<string, unknown>>().nullable(),
  })
  .indexes([{ on: ["entity_type", "entity_id", "created_at"] }])

export default MarketingAuditLog
