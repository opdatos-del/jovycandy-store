import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import JovyCatalogueModule from "@jovy/modules/jovy-catalogue"

/**
 * Una familia agrupa varios productos y un producto pertenece a lo sumo a una
 * familia. La relación vive en la tabla de enlace, así que el catálogo no
 * duplica SKU, precio ni stock.
 */
export default defineLink(
  JovyCatalogueModule.linkable.jovyProductFamily,
  {
    linkable: ProductModule.linkable.product,
    isList: true,
  },
)
