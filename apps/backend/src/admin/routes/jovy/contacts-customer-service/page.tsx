import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Lifebuoy } from "@medusajs/icons"
import { ContactInbox } from "../contacts/components/contact-inbox"

const CustomerServiceInbox = () => (
  <ContactInbox title="Atención al cliente" contactType="customer-service" description="Dudas, aclaraciones y seguimiento postventa." />
)

export const config = defineRouteConfig({ label: "Atención al cliente", icon: Lifebuoy, rank: 12 })
export default CustomerServiceInbox
