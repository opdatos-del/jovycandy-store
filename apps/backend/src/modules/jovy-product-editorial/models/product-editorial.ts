import { model } from "@medusajs/framework/utils"
import { COMMERCIAL_MODES, PRODUCT_EDITORIAL_STATUSES } from "@jovy/lib/jovy/product-editorial"

/**
 * Ficha editorial de un producto comercial de Medusa. `product_id` es único y
 * apunta al Product Module: no se copian título, SKU, precio, stock, variantes
 * ni imágenes. `certifications` es un array JSON validado contra el catálogo de
 * `PRODUCT_CERTIFICATIONS`; `gramaje` es texto corto opcional y no bloquea la
 * publicación, igual que en el CMS histórico.
 */
const ProductEditorial = model
  .define("jovy_product_editorial", {
    id: model.id().primaryKey(),
    product_id: model.text(),
    gramaje: model.text().nullable(),
    certifications: model.json<string[]>().default([]),
    sort_order: model.number().default(0),
    is_new: model.boolean().default(false),
    editorial_status: model.enum([...PRODUCT_EDITORIAL_STATUSES]).default("draft"),
    // Modalidad de venta. `null` identifica una ficha histórica informativa: se
    // resuelve como CATALOG_ONLY, nunca se auto-clasifica como vendible.
    commercial_mode: model.enum([...COMMERCIAL_MODES]).nullable(),
    published_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["product_id"], unique: true },
    { on: ["editorial_status", "sort_order"] },
  ])

export default ProductEditorial
