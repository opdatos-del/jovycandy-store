import { model } from "@medusajs/framework/utils"
import { CATALOGUE_CATEGORY_KEYS } from "@jovy/lib/jovy/catalogue"

/**
 * Tarjeta de presentación del catálogo. No es la Product Category de Medusa:
 * `medusa_category_id` es un enlace lógico opcional para derivar familias y
 * productos publicados. `key` es la clave pública fija consumida por Store.
 */
const CatalogueCategory = model
  .define("jovy_catalogue_category", {
    id: model.id().primaryKey(),
    key: model.enum([...CATALOGUE_CATEGORY_KEYS]),
    name: model.text(),
    description: model.text().nullable(),
    sort_order: model.number().default(0),
    active: model.boolean().default(true),
    coming_soon: model.boolean().default(false),
    interaction_locked: model.boolean().default(false),
    image_file_id: model.text().nullable(),
    image_url: model.text().nullable(),
    medusa_category_id: model.text().nullable(),
  })
  .indexes([
    { on: ["key"], unique: true },
    { on: ["sort_order", "active"] },
  ])

export default CatalogueCategory
