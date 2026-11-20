import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Globe } from "@medusajs/icons"
import { ContactInbox } from "@admin/features/contacts/components/contact-inbox"

const InternationalSalesInbox = () => (
  <ContactInbox title="Ventas Internacionales" contactType="international-sales" description="Solicitudes de exportación y distribución fuera de México." />
)

export const config = defineRouteConfig({ label: "Ventas Internacionales", icon: Globe, rank: 9, permissions: "jovy_contacts_international:read" })
export default InternationalSalesInbox
