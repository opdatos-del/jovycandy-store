import { model } from "@medusajs/framework/utils"

/**
 * Taxonomía canónica de familias. `slug` es el identificador público que el
 * histórico guardaba como `family_id`. Los productos se asocian mediante el
 * Module Link `jovy_product_family.product`; este modelo no duplica SKU,
 * precio ni stock.
 */
const ProductFamily = model
  .define("jovy_product_family", {
    id: model.id().primaryKey(),
    name: model.text(),
    slug: model.text(),
    description: model.text().nullable(),
    medusa_category_id: model.text().nullable(),
    sort_order: model.number().default(0),
    active: model.boolean().default(true),
  })
  .indexes([
    { on: ["slug"], unique: true },
    { on: ["sort_order", "active"] },
  ])

export default ProductFamily
