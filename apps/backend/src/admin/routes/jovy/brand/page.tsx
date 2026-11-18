import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Swatch } from "@medusajs/icons"
import { Container, Heading } from "@medusajs/ui"
import { BrandGalleryManager } from "./components/gallery-manager"

const BrandPage = () => {
  return <div className="flex flex-col gap-y-4" data-jovy-quality>
    <Container className="p-6">
      <Heading level="h1" className="jovy-title">Casa Jovy Galería</Heading>
      <p className="text-ui-fg-subtle text-sm">
        Galería de imágenes de Casa Jovy: publica, ordena y programa sus elementos.
      </p>
    </Container>

    <BrandGalleryManager />
  </div>
}

export const config = defineRouteConfig({ label: "Casa Jovy Galería", icon: Swatch, rank: 4 })
export default BrandPage
