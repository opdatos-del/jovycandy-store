import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Swatch } from "@medusajs/icons"
import { GalleryPage } from "@admin/features/gallery"

/**
 * La ruta sólo registra el acceso; el gestor y sus componentes viven en
 * `@admin/features/gallery`.
 */
export const config = defineRouteConfig({ label: "Casa Jovy Galería", icon: Swatch, rank: 4, permissions: "jovy_gallery:read" })
export default GalleryPage
