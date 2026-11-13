import { model } from "@medusajs/framework/utils"

const JovyEvent = model
  .define("jovy_event", {
    id: model.id().primaryKey(),
    event_type_id: model.text().nullable(),
    title: model.text(),
    title_en: model.text().nullable(),
    slug: model.text(),
    description: model.text().nullable(),
    content: model.text().nullable(),
    media_file_id: model.text().nullable(),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    status: model.enum(["draft", "published", "archived", "cancelled"]).default("draft"),
    enabled: model.boolean().default(true),
    priority: model.number().default(0),
    sort_order: model.number().default(0),
    published_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["slug"], unique: true },
    { on: ["status", "enabled", "starts_at", "ends_at", "priority", "sort_order"] },
  ])

export default JovyEvent
