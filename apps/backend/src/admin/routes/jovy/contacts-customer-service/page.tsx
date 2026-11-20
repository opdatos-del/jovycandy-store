import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Lifebuoy } from "@medusajs/icons"
import { ContactInbox } from "@admin/features/contacts/components/contact-inbox"

const CustomerServiceInbox = () => (
  <ContactInbox title="Atención al Cliente" contactType="customer-service" description="Dudas, aclaraciones y seguimiento postventa." />
)

export const config = defineRouteConfig({ label: "Atención al Cliente", icon: Lifebuoy, rank: 10 })
export default CustomerServiceInbox
