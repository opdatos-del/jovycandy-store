import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import { ContactInbox } from "@admin/features/contacts/components/contact-inbox"

const NationalSalesInbox = () => (
  <ContactInbox title="Ventas Nacionales" contactType="national-sales" description="Solicitudes de mayoreo y distribución en México." />
)

export const config = defineRouteConfig({ label: "Ventas Nacionales", icon: BuildingStorefront, rank: 8, permissions: "jovy_contacts_national:read" })
export default NationalSalesInbox
