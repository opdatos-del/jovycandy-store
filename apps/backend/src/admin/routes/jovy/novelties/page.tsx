import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Images } from "@medusajs/icons"
import { NoveltiesPage } from "@admin/features/novelties/components/novelties-page"

/**
 * La ruta sólo registra el acceso; la bandeja multimedia vive en
 * `@admin/features/novelties`.
 */
export const config = defineRouteConfig({ label: "Novedades", icon: Images, rank: 7, permissions: "jovy_events:read" })
export default NoveltiesPage
