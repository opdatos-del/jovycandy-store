import { model } from "@medusajs/framework/utils"
import type { LocalizedMarketingContent } from "./hero-item"

const MarketingBanner = model
  .define("jovy_marketing_banner", {
    id: model.id().primaryKey(),
    slot: model.enum(["promo", "hint"]),
    translations: model.json<Record<"es" | "en", LocalizedMarketingContent & { alt: string }>>(),
    status: model.enum(["draft", "published", "archived"]).default("draft"),
    enabled: model.boolean().default(true),
    auto_open: model.boolean().default(false),
    // `once` limita la aparición a una vez por navegador; el resto se repite
    // según la ventana que decida el storefront.
    frequency: model.enum(["every", "session", "daily", "once"]).default("every"),
    // Duración en pantalla de cada banner, en segundos (rango 3–60).
    // La rotación la ejecuta el storefront; el backend solo persiste el valor.
    rotation_seconds: model.number().default(8),
    priority: model.number().default(0),
    sort_order: model.number().default(0),
    media_file_id: model.text().nullable(),
    cta_url: model.text().nullable(),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    published_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["slot", "status", "enabled", "priority", "sort_order", "starts_at", "ends_at"] },
  ])

export default MarketingBanner
