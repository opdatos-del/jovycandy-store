import { defineWidgetConfig } from "@medusajs/admin-sdk"

import { ProductCardVisualWidget } from "@admin/features/product-card-visual/components/product-card-visual-widget"

export const config = defineWidgetConfig({
  zone: "product.details.after",
  id: "jovy:product-card-visual",
})

const ProductCardVisualWidgetEntry = ({ data }: { data: { id: string } }) => (
  <ProductCardVisualWidget productId={data.id} />
)

export default ProductCardVisualWidgetEntry
