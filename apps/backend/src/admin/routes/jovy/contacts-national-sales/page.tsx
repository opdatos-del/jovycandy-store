import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import { ContactInbox } from "../contacts/components/contact-inbox"

const NationalSalesInbox = () => (
  <ContactInbox title="Ventas nacionales" contactType="national-sales" description="Solicitudes de mayoreo y distribución en México." />
)

export const config = defineRouteConfig({ label: "Ventas nacionales", icon: BuildingStorefront, rank: 10 })
export default NationalSalesInbox
