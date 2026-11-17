import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
// eslint-disable-next-line no-restricted-imports -- el Vite del Admin no resuelve el alias @jovy; la ruta relativa cruzando grupos es necesaria
import { ContactInbox } from "../../jovy-herramientas/contacts/components/contact-inbox"

/**
 * `/app/jovy/catalogue` belongs to the catalogue categories block, so the
 * catalogue inbox owns `/app/jovy/contacts-catalogue` instead of a sibling name.
 */
const CatalogueInbox = () => (
  <ContactInbox title="Catálogo — Solicitudes" contactType="catalogue" description="Solicitudes de catálogo impreso o digital." />
)

export const config = defineRouteConfig({ label: "Catálogo — Solicitudes", icon: Tag, rank: 11 })
export default CatalogueInbox
