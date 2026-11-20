import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"
import { ContentPage } from "@admin/features/content/components/content-page"

/**
 * La ruta sólo registra el acceso; la pantalla editorial vive en
 * `@admin/features/content`.
 */
export const config = defineRouteConfig({
  label: "Contenido Jovy",
  icon: DocumentText,
  rank: 2,
  permissions: "jovy_content:read",
})

export default ContentPage
