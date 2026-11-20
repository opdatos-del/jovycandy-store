import { Container, Heading, Text } from "@medusajs/ui"
import { CorporateMessagePanel } from "./corporate-message-panel"
import { HeroManager } from "./hero-manager"

/**
 * Marketing administra el Hero corporativo y el mensaje corporativo que se
 * muestra bajo su animación. Los banners y anuncios de portada tienen un único
 * CRUD en Anuncios de portada, enlazado con un `<a>` nativo: el Admin empaqueta
 * dos copias de react-router-dom y un `Link` del router equivocado renderiza una
 * copia duplicada de la pantalla.
 */
export const MarketingPage = () => (
  <div className="flex flex-col gap-y-4">
    <HeroManager />

    <CorporateMessagePanel />

    <Container className="p-4 sm:p-6" data-testid="marketing-announcements-link">
      <Heading level="h2" className="text-base">
        Anuncios de portada
      </Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Los banners y anuncios de portada se gestionan en Anuncios de portada.
      </Text>
      <a
        href="/app/jovy/announcements"
        className="text-ui-fg-interactive mt-3 inline-block text-sm underline"
      >
        Abrir Anuncios de portada
      </a>
    </Container>
  </div>
)
