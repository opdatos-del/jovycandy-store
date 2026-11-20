import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BellAlert } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { BannerManager } from "@admin/features/announcements/components/banner-manager"

/**
 * Anuncios de portada es el único CRUD de banners y anuncios (`promo` y `hint`).
 * El mensaje corporativo pertenece al Hero y se administra en Marketing Jovy.
 */
const AnnouncementsPage = () => (
  <div className="flex flex-col gap-y-4" data-jovy-quality data-testid="jovy-announcements-page">
    <Container className="p-4 sm:p-6">
      <Heading level="h1" className="jovy-title">Anuncios de portada</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Dos tipos de anuncio: banners fijos bajo el logo y el modal de entrada.
      </Text>
    </Container>

    <Container className="p-4 sm:p-6" data-testid="announcements-banners-block">
      <Heading level="h2" className="jovy-subtitle">Banners y anuncios</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Elige si el anuncio aparece bajo el logo o como modal de entrada. Publica y programa aquí.
      </Text>
      <div className="mt-4">
        <BannerManager heading="" showDescription={false} showStats={false} listHeadingLevel="h3" />
      </div>
    </Container>
  </div>
)

export const config = defineRouteConfig({
  label: "Anuncios de portada",
  icon: BellAlert,
  rank: 6,
})

export default AnnouncementsPage
