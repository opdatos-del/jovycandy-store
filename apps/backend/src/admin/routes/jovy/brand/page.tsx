import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Swatch } from "@medusajs/icons"
import { Button, Container, Heading } from "@medusajs/ui"
import { useState } from "react"
import { BrandGalleryManager } from "./components/gallery-manager"
import { BrandLogoManager } from "./components/logo-manager"

const BrandPage = () => {
  const [section, setSection] = useState<"gallery" | "logos">("gallery")

  return <div className="flex flex-col gap-y-4">
    <Container className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level="h1">Marca Jovy</Heading>
          <p className="text-ui-fg-subtle text-sm">
            Galería Casa Jovy y logos corporativos administrados desde Medusa.
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Secciones de Marca Jovy">
          <Button
            variant={section === "gallery" ? "primary" : "secondary"}
            aria-pressed={section === "gallery"}
            onClick={() => setSection("gallery")}
          >
            Galería Casa Jovy
          </Button>
          <Button
            variant={section === "logos" ? "primary" : "secondary"}
            aria-pressed={section === "logos"}
            onClick={() => setSection("logos")}
          >
            Logos
          </Button>
        </div>
      </div>
    </Container>

    {section === "gallery" ? <BrandGalleryManager /> : <BrandLogoManager />}
  </div>
}

export const config = defineRouteConfig({ label: "Casa Jovy Galería", icon: Swatch, rank: 5 })
export default BrandPage
