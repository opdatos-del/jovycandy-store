import { model } from "@medusajs/framework/utils"

export default model
  .define("jovy_gallery_item", {
    id: model.id().primaryKey(),
    title: model.text().nullable(),
    description: model.text().nullable(),
    media_file_id: model.text(),
    status: model.enum(["draft", "published", "archived"]).default("draft"),
    enabled: model.boolean().default(true),
    sort_order: model.number().default(0),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    published_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["status", "enabled", "starts_at", "ends_at", "sort_order"] }])
