import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Envelope } from "@medusajs/icons"
import { ContactInbox } from "@admin/features/contacts/components/contact-inbox"

const ContactsPage = () => (
  <ContactInbox
    title="Contactos"
    description="Solicitudes privadas de las cuatro bandejas. Los datos personales no se exponen por Store API."
  />
)

export const config = defineRouteConfig({
  label: "Contactos Jovy",
  icon: Envelope,
  rank: 5,
  permissions: [
    "jovy_contacts_national:read",
    "jovy_contacts_international:read",
    "jovy_contacts_customer_service:read",
    "jovy_contacts_catalogue:read",
  ],
})
export default ContactsPage
