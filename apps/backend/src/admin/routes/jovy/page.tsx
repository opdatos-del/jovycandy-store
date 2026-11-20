// eslint-disable-next-line no-restricted-imports -- el Vite del Admin no resuelve el alias @jovy para CSS; la hoja vive en src/admin/styles
import "../../styles/jovy-quality.css"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { SquaresPlus } from "@medusajs/icons"
import { DashboardPage } from "@admin/features/dashboard/components/dashboard-page"

export const config = defineRouteConfig({
  label: "JovyCandy CMS",
  icon: SquaresPlus,
  rank: 0,
})

export default DashboardPage
