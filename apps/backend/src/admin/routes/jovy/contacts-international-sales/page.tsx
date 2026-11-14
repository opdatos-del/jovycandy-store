import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Globe } from "@medusajs/icons"
import { ContactInbox } from "../contacts/components/contact-inbox"

const InternationalSalesInbox = () => (
  <ContactInbox title="Ventas internacionales" contactType="international-sales" description="Solicitudes de exportación y distribución fuera de México." />
)

export const config = defineRouteConfig({ label: "Ventas internacionales", icon: Globe, rank: 11 })
export default InternationalSalesInbox
