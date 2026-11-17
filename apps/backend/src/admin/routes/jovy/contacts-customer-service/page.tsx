import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Lifebuoy } from "@medusajs/icons"
// eslint-disable-next-line no-restricted-imports -- el Vite del Admin no resuelve el alias @jovy; la ruta relativa cruzando grupos es necesaria
import { ContactInbox } from "../../jovy-herramientas/contacts/components/contact-inbox"

const CustomerServiceInbox = () => (
  <ContactInbox title="Atención al Cliente" contactType="customer-service" description="Dudas, aclaraciones y seguimiento postventa." />
)

export const config = defineRouteConfig({ label: "Atención al Cliente", icon: Lifebuoy, rank: 12 })
export default CustomerServiceInbox
