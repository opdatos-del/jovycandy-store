import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Sparkles } from "@medusajs/icons"
import { Button } from "@medusajs/ui"
import { useState } from "react"
import { BannerManager } from "./components/banner-manager"
import { HeroManager } from "./components/hero-manager"

const MarketingPage = () => {
  // Atajos desde otras pantallas: `?tab=banners&slot=promo` abre el gestor de
  // Banners con el slot promocional preseleccionado, sin duplicar formularios.
  // Lectura directa de la URL: el Admin empaqueta dos copias de react-router-dom y
  // cualquier hook del router fuera de su contexto rompe la pantalla.
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
  const initialSection = params.get("tab") === "banners" ? "banners" : "hero"
  const initialSlot = params.get("slot") === "hint" ? "hint" : "promo"
  const [section, setSection] = useState<"hero" | "banners">(initialSection)

  return <div className="flex flex-col gap-y-4">
    <div className="flex gap-2"><Button variant={section === "hero" ? "primary" : "secondary"} onClick={() => setSection("hero")}>Hero</Button><Button variant={section === "banners" ? "primary" : "secondary"} onClick={() => setSection("banners")}>Banners</Button></div>
    {section === "hero" ? <HeroManager /> : <BannerManager initialSlot={initialSlot} />}
  </div>
}

export const config = defineRouteConfig({ label: "Marketing Jovy", icon: Sparkles, rank: 4 })
export default MarketingPage
