import { model } from "@medusajs/framework/utils"

export type LocalizedMarketingContent = {
  title: string
  description?: string
  cta_label?: string
}

const HeroItem = model
  .define("jovy_hero_item", {
    id: model.id().primaryKey(),
    translations: model.json<Record<"es" | "en", LocalizedMarketingContent>>(),
    status: model.enum(["draft", "published", "archived"]).default("draft"),
    enabled: model.boolean().default(true),
    sort_order: model.number().default(0),
    background_color: model.text().nullable(),
    media_file_id: model.text().nullable(),
    cta_url: model.text().nullable(),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    published_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["status", "enabled", "starts_at", "ends_at", "sort_order"] },
  ])

export default HeroItem
