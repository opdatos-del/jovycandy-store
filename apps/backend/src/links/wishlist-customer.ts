import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"
import CustomerSpace from "@jovy/modules/jovy-customer-space"

export default defineLink(
  { linkable: CustomerSpace.linkable.jovyWishlist.id, field: "customer_id" },
  CustomerModule.linkable.customer,
  { readOnly: true },
)
