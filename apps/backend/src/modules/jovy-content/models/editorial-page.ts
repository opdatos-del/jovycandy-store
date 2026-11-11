import { model } from "@medusajs/framework/utils"

export type LocalizedPageContent = {
  title: string
  excerpt?: string
  body?: string
}

export type LocalizedSeoContent = {
  title?: string
  description?: string
  image_file_id?: string
}

const EditorialPage = model
  .define("jovy_editorial_page", {
    id: model.id().primaryKey(),
    slug: model.text(),
    status: model.enum(["draft", "published", "archived"]).default("draft"),
    translations: model.json<Record<"es" | "en", LocalizedPageContent>>(),
    seo: model.json<Partial<Record<"es" | "en", LocalizedSeoContent>>>().nullable(),
    published_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["slug"],
      unique: true,
    },
    {
      on: ["status", "published_at"],
    },
  ])

export default EditorialPage
