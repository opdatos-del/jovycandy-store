import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Globe } from "@medusajs/icons"
// eslint-disable-next-line no-restricted-imports -- el Vite del Admin no resuelve el alias @jovy; la ruta relativa cruzando grupos es necesaria
import { ContactInbox } from "../../jovy-herramientas/contacts/components/contact-inbox"

const InternationalSalesInbox = () => (
  <ContactInbox title="Ventas Internacionales" contactType="international-sales" description="Solicitudes de exportación y distribución fuera de México." />
)

export const config = defineRouteConfig({ label: "Ventas Internacionales", icon: Globe, rank: 11 })
export default InternationalSalesInbox
