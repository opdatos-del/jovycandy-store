import { defineWidgetConfig } from "@medusajs/admin-sdk"
import ProductEditorialWidget from "@admin/features/product-editorial/components/product-editorial-widget"

export const config = defineWidgetConfig({
  zone: "product.details",
  id: "jovy:product-editorial",
})

export default ProductEditorialWidget
