import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import JovyMarketingModule from "@jovy/modules/jovy-marketing"

export default defineLink(
  ProductModule.linkable.product,
  {
    linkable: JovyMarketingModule.linkable.jovyHeroItem,
    isList: true,
  },
)
