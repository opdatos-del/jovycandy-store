import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import { ContactInbox } from "../contacts/components/contact-inbox"

/**
 * `/app/jovy/catalogue` belongs to the catalogue categories block, so the
 * catalogue inbox owns `/app/jovy/contacts-catalogue` instead of a sibling name.
 */
const CatalogueInbox = () => (
  <ContactInbox title="Catálogo" contactType="catalogue" description="Solicitudes de catálogo impreso o digital." />
)

export const config = defineRouteConfig({ label: "Catálogo", icon: Tag, rank: 13 })
export default CatalogueInbox
