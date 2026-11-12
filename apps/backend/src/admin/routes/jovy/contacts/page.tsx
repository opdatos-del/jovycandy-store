import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Textarea } from "@medusajs/ui"
import { useEffect, useState } from "react"

type ContactType = "national-sales" | "international-sales" | "customer-service" | "catalogue"
type ContactStatus = "pending" | "handled"
type Contact = {
  id: string
  first_name: string
  last_name: string | null
  email: string
  phone: string | null
  country: string | null
  city: string | null
  postal_code: string | null
  contact_type: ContactType
  message: string
  status: ContactStatus
  admin_notes: string | null
  created_at: string
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Operación no disponible" })) as { message?: string }
    throw new Error(body.message || "Operación no disponible")
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

const ContactsPage = () => {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selected, setSelected] = useState<Contact | null>(null)
  const [status, setStatus] = useState<ContactStatus | "">("")
  const [contactType, setContactType] = useState<ContactType | "">("")
  const [query, setQuery] = useState("")
  const [notes, setNotes] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      if (contactType) params.set("contact_type", contactType)
      if (query.trim()) params.set("q", query.trim())
      const result = await api<{ contacts: Contact[] }>(`/admin/jovy/contacts${params.size ? `?${params}` : ""}`)
      setContacts(result.contacts)
      setMessage(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron cargar las solicitudes.") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [status, contactType])

  const select = async (id: string) => {
    try {
      const result = await api<{ contact: Contact }>(`/admin/jovy/contacts/${id}`)
      setSelected(result.contact)
      setNotes(result.contact.admin_notes || "")
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo abrir la solicitud.") }
  }
  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const result = await api<{ contact: Contact }>(`/admin/jovy/contacts/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: selected.status, admin_notes: notes || null }),
      })
      setSelected(result.contact)
      setNotes(result.contact.admin_notes || "")
      setMessage("Seguimiento guardado.")
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar el seguimiento.") }
    finally { setSaving(false) }
  }
  const remove = async () => {
    if (!selected || !window.confirm("¿Eliminar lógicamente esta solicitud?")) return
    try {
      await api(`/admin/jovy/contacts/${selected.id}`, { method: "DELETE" })
      setSelected(null)
      setNotes("")
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo eliminar la solicitud.") }
  }

  return <div className="flex flex-col gap-y-4"><Container className="p-6"><Heading level="h1">Contactos</Heading><p className="mt-1 text-ui-fg-subtle text-sm">Solicitudes privadas. Los datos personales no se exponen por Store API.</p>{message && <p role="alert" className="mt-3 text-ui-fg-error">{message}</p>}</Container>
    <Container className="p-6"><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><Input aria-label="Buscar contacto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, email o tipo" /><select aria-label="Estado contacto" value={status} onChange={(event) => setStatus(event.target.value as ContactStatus | "")}><option value="">Todos los estados</option><option value="pending">Pendiente</option><option value="handled">Atendido</option></select><select aria-label="Tipo contacto" value={contactType} onChange={(event) => setContactType(event.target.value as ContactType | "")}><option value="">Todos los tipos</option><option value="national-sales">Ventas nacionales</option><option value="international-sales">Ventas internacionales</option><option value="customer-service">Atención a clientes</option><option value="catalogue">Catálogo</option></select><Button variant="secondary" onClick={() => void load()}>Buscar</Button></div>
      {loading ? <p className="mt-4 text-ui-fg-subtle">Cargando solicitudes…</p> : contacts.length === 0 ? <p className="mt-4 text-ui-fg-subtle">No hay solicitudes para los filtros seleccionados.</p> : <ul className="mt-4 divide-y">{contacts.map((contact) => <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{contact.first_name} {contact.last_name || ""}</p><p className="text-ui-fg-subtle text-sm">{contact.contact_type} · {new Date(contact.created_at).toLocaleString()}</p></div><div className="flex items-center gap-2"><Badge color={contact.status === "handled" ? "green" : "orange"}>{contact.status === "handled" ? "atendido" : "pendiente"}</Badge><Button size="small" variant="secondary" onClick={() => void select(contact.id)}>Ver seguimiento</Button></div></li>)}</ul>}</Container>
    {selected && <Container className="p-6"><div className="flex items-center justify-between"><Heading level="h2">Solicitud de {selected.first_name}</Heading><Button size="small" variant="secondary" onClick={() => setSelected(null)}>Cerrar</Button></div><div className="mt-4 grid gap-2 text-sm"><p><strong>Email:</strong> {selected.email}</p>{selected.phone && <p><strong>Teléfono:</strong> {selected.phone}</p>}<p><strong>Tipo:</strong> {selected.contact_type}</p><p><strong>Mensaje:</strong> {selected.message}</p></div><div className="mt-4 flex max-w-3xl flex-col gap-3"><select aria-label="Estado de seguimiento" value={selected.status} onChange={(event) => setSelected({ ...selected, status: event.target.value as ContactStatus })}><option value="pending">Pendiente</option><option value="handled">Atendido</option></select><Textarea aria-label="Notas administrativas" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Seguimiento interno; no se publica." /><div className="flex gap-2"><Button isLoading={saving} onClick={() => void save()}>Guardar seguimiento</Button><Button variant="danger" onClick={() => void remove()}>Eliminar lógicamente</Button></div></div></Container>}
  </div>
}

export const config = defineRouteConfig({ label: "Contactos Jovy" })
export default ContactsPage
