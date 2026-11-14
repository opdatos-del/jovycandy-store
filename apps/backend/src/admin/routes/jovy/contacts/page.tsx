import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Envelope } from "@medusajs/icons"
import { ContactInbox } from "./components/contact-inbox"

const ContactsPage = () => (
  <ContactInbox
    title="Contactos"
    description="Solicitudes privadas de las cuatro bandejas. Los datos personales no se exponen por Store API."
  />
)

export const config = defineRouteConfig({ label: "Contactos Jovy", icon: Envelope, rank: 50 })
export default ContactsPage
