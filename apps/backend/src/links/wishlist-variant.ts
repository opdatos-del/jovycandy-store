import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import CustomerSpace from "@jovy/modules/jovy-customer-space"

export default defineLink(
  { linkable: CustomerSpace.linkable.jovyWishlistItem.id, field: "product_variant_id" },
  ProductModule.linkable.productVariant,
  { readOnly: true },
)
