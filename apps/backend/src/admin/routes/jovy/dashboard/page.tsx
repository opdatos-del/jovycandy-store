import { defineRouteConfig } from "@medusajs/admin-sdk"
import { SquaresPlus } from "@medusajs/icons"
import DashboardPage from "../page"

/**
 * Entrada «Dashboard» del grupo JovyCandy CMS. Reutiliza el tablero del padre
 * para que la ruta canónica y la raíz del grupo muestren exactamente la misma
 * información.
 */
export const config = defineRouteConfig({
  label: "Dashboard",
  icon: SquaresPlus,
  rank: 1,
  permissions: "jovy_dashboard:read",
})

export default DashboardPage
