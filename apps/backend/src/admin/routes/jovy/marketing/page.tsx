import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button } from "@medusajs/ui"
import { useState } from "react"
import { BannerManager } from "./components/banner-manager"
import { HeroManager } from "./components/hero-manager"

const MarketingPage = () => {
  const [section, setSection] = useState<"hero" | "banners">("hero")

  return <div className="flex flex-col gap-y-4">
    <div className="flex gap-2"><Button variant={section === "hero" ? "primary" : "secondary"} onClick={() => setSection("hero")}>Hero</Button><Button variant={section === "banners" ? "primary" : "secondary"} onClick={() => setSection("banners")}>Banners</Button></div>
    {section === "hero" ? <HeroManager /> : <BannerManager />}
  </div>
}

export const config = defineRouteConfig({ label: "Marketing Jovy" })
export default MarketingPage
