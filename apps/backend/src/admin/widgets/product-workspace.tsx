import { defineWidgetConfig } from "@medusajs/admin-sdk"

import { ProductWorkspaceBar } from "@admin/features/product-workspace/components/product-workspace-bar"

export const config = defineWidgetConfig({
  zone: "product.details.before",
  id: "jovy:product-workspace",
})

type ProductWidgetData = {
  id: string
  title?: string
  status?: string
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
}

const ProductWorkspaceWidget = ({ data }: { data: ProductWidgetData }) => (
  <ProductWorkspaceBar product={data} />
)

export default ProductWorkspaceWidget
