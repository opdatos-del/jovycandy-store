import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Swatch } from "@medusajs/icons"
import { Container, Heading } from "@medusajs/ui"
import { BrandLogoManager } from "@admin/features/logos"

/**
 * Entrada canónica de «Logos» del administrador histórico. Reutiliza el gestor
 * de la marca; no duplica lógica ni endpoints.
 */
const LogosPage = () => (
  <div className="flex flex-col gap-y-4" data-jovy-quality>
    <Container className="p-6">
      <Heading level="h1" className="jovy-title">Logos</Heading>
    </Container>
    <BrandLogoManager />
  </div>
)

export const config = defineRouteConfig({
  label: "Logos",
  icon: Swatch,
  rank: 5,
})

export default LogosPage
