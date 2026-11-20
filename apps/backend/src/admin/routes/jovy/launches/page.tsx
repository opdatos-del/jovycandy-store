import { defineRouteConfig } from "@medusajs/admin-sdk"
import { RocketLaunch } from "@medusajs/icons"
import { LaunchesPage } from "@admin/features/launches/components/launches-page"

/**
 * La ruta sólo registra el acceso; la administración de lanzamientos vive en
 * `@admin/features/launches`.
 */
export const config = defineRouteConfig({
  label: "Nuevos Lanzamientos",
  icon: RocketLaunch,
  rank: 3,
  permissions: "jovy_launches:read",
})

export default LaunchesPage
