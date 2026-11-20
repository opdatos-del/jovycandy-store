import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import { CataloguePage } from "@admin/features/catalogue/components/catalogue-page"

/**
 * La ruta sólo registra el acceso; las tarjetas del catálogo viven en
 * `@admin/features/catalogue`.
 */
export const config = defineRouteConfig({
  label: "Categorías",
  icon: Tag,
  rank: 2,
})

export default CataloguePage
