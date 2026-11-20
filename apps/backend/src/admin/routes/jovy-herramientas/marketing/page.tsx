import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Sparkles } from "@medusajs/icons"
import { MarketingPage } from "@admin/features/marketing/components/marketing-page"

export const config = defineRouteConfig({ label: "Marketing Jovy", icon: Sparkles, rank: 4 })

export default MarketingPage
