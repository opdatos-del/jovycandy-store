import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
// eslint-disable-next-line no-restricted-imports -- el Vite del Admin no resuelve el alias @jovy; la ruta relativa cruzando grupos es necesaria
import { ContactInbox } from "../../jovy-herramientas/contacts/components/contact-inbox"

const NationalSalesInbox = () => (
  <ContactInbox title="Ventas Nacionales" contactType="national-sales" description="Solicitudes de mayoreo y distribución en México." />
)

export const config = defineRouteConfig({ label: "Ventas Nacionales", icon: BuildingStorefront, rank: 10 })
export default NationalSalesInbox
