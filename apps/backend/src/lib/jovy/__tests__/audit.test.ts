import { contactAuditMetadata } from "@jovy/lib/jovy/audit"

const contact = {
  id: "req_01",
  first_name: "Ana",
  last_name: "Pérez",
  email: "ana@example.test",
  phone: "+52 55 0000 0000",
  message: "Mensaje privado con datos personales.",
  admin_notes: "Nota interna con datos personales.",
  contact_type: "customer-service",
  status: "pending",
}

describe("auditoría de contactos sin datos personales", () => {
  it("sólo guarda tipo y estado al crear", () => {
    expect(contactAuditMetadata("create", contact)).toEqual({
      contact_type: "customer-service",
      status: "pending",
    })
  })

  it("guarda el estado en cambios de estado y en el borrado", () => {
    expect(contactAuditMetadata("status", { ...contact, status: "handled" })).toEqual({ status: "handled" })
    expect(contactAuditMetadata("delete", contact)).toEqual({ status: "pending" })
  })

  it("no guarda metadatos al editar notas", () => {
    expect(contactAuditMetadata("note", contact)).toBeUndefined()
  })

  it("descarta cualquier dato personal recibido en el registro completo", () => {
    const serialized = JSON.stringify([
      contactAuditMetadata("create", contact),
      contactAuditMetadata("status", contact),
      contactAuditMetadata("delete", contact),
      contactAuditMetadata("note", contact),
    ])
    for (const personal of [contact.first_name, contact.last_name, contact.email, contact.phone, contact.message, contact.admin_notes]) {
      expect(serialized).not.toContain(personal)
    }
  })

  it("no inventa claves fuera del contrato", () => {
    for (const action of ["create", "status", "note", "delete"] as const) {
      const metadata = contactAuditMetadata(action, contact) ?? {}
      expect(Object.keys(metadata).every((key) => key === "status" || key === "contact_type")).toBe(true)
    }
  })
})
