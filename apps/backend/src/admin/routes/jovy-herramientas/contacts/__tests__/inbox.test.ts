import {
  CONTACT_AUDIT_LABELS,
  CONTACT_TYPE_LABELS,
  contactDraftFrom,
  contactExportParams,
  contactListParams,
  contactName,
  contactStatusLabel,
  contactUpdatePayload,
  formatDateTime,
  inboxCounts,
  inboxTabCounts,
  locationText,
  mergeSeenIds,
  newContactIds,
  paginationItems,
  parseExportCount,
  previewMessage,
  validateContactDraft,
  type Contact,
  type ContactCounts,
} from "../components/inbox"

const counts: ContactCounts = {
  "national-sales": { pending: 2, handled: 1, deleted: 1, total: 4 },
  "international-sales": { pending: 0, handled: 0, deleted: 0, total: 0 },
  "customer-service": { pending: 5, handled: 4, deleted: 2, total: 11 },
  catalogue: { pending: 1, handled: 2, deleted: 0, total: 3 },
}

const contact: Contact = {
  id: "req_01",
  first_name: "Ana",
  last_name: "Pérez",
  email: "ana@example.test",
  phone: "+52 33 1234 5678",
  country: "MX",
  city: "Guadalajara",
  postal_code: "44100",
  contact_type: "national-sales",
  message: "Consulta DEMO.",
  status: "pending",
  admin_notes: null,
  created_at: "2026-11-13T10:15:00.000Z",
  handled_at: null,
  handled_by: null,
  deleted_at: null,
}

describe("bandejas de contactos", () => {
  it("usa los nombres exactos de las cuatro entradas administrativas", () => {
    expect(CONTACT_TYPE_LABELS).toEqual({
      "national-sales": "Ventas nacionales",
      "international-sales": "Ventas internacionales",
      "customer-service": "Atención al cliente",
      catalogue: "Catálogo",
    })
  })

  it("fija el tipo de la bandeja aunque la búsqueda esté vacía", () => {
    expect(contactListParams({ contactType: "catalogue" })).toBe(
      "contact_type=catalogue&limit=20&offset=0",
    )
  })

  it("envía estado, búsqueda normalizada, rango y paginación", () => {
    expect(
      contactListParams({
        status: "pending",
        q: "  ana  ",
        dateFrom: "2026-11-01",
        dateTo: "2026-11-30",
        offset: 20,
        limit: 10,
      }),
    ).toBe(
      "status=pending&q=ana&date_from=2026-11-01&date_to=2026-11-30&limit=10&offset=20",
    )
  })

  it("envía la papelera como estado y omite los filtros vacíos", () => {
    expect(contactListParams({ status: "deleted" })).toBe("status=deleted&limit=20&offset=0")
    expect(contactListParams({ status: "all", q: "   " })).toBe("limit=20&offset=0")
  })

  it("rechaza tamaños de página ajenos a 10, 20 y 50", () => {
    expect(contactListParams({ limit: 25 })).toBe("limit=20&offset=0")
    expect(contactListParams({ limit: 50, offset: -3 })).toBe("limit=50&offset=0")
  })

  it("exporta solo una bandeja con los filtros aplicados", () => {
    expect(
      contactExportParams({
        contactType: "customer-service",
        status: "handled",
        q: " ana ",
        dateFrom: "2026-11-01",
      }),
    ).toBe(
      "contact_type=customer-service&format=csv&status=handled&q=ana&date_from=2026-11-01",
    )
    expect(contactExportParams({ contactType: "catalogue", status: "all" })).toBe(
      "contact_type=catalogue&format=csv",
    )
  })

  it("suma las cuatro bandejas solo en la vista consolidada", () => {
    expect(inboxCounts(counts, "catalogue")).toEqual({
      pending: 1,
      handled: 2,
      deleted: 0,
      total: 3,
    })
    expect(inboxCounts(counts)).toEqual({ pending: 8, handled: 7, deleted: 3, total: 18 })
    expect(inboxCounts(null, "national-sales")).toEqual({
      pending: 0,
      handled: 0,
      deleted: 0,
      total: 0,
    })
    expect(inboxCounts(null)).toEqual({ pending: 0, handled: 0, deleted: 0, total: 0 })
  })

  it("cuenta Todos sin la papelera para que el badge coincida con la tabla", () => {
    expect(inboxTabCounts({ pending: 8, handled: 7, deleted: 3, total: 18 })).toEqual({
      all: 15,
      pending: 8,
      handled: 7,
      deleted: 3,
    })
  })

  it("genera una paginación numerada compacta y estable", () => {
    expect(paginationItems(1, 1)).toEqual([1])
    expect(paginationItems(3, 5)).toEqual([1, 2, 3, 4, 5])
    expect(paginationItems(1, 10)).toEqual([1, 2, "ellipsis", 10])
    expect(paginationItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10])
    expect(paginationItems(99, 10)).toEqual([1, "ellipsis", 9, 10])
    expect(paginationItems(0, 0)).toEqual([1])
  })

  it("recorta el mensaje a la vista previa sin cortar palabras a la mitad del espacio", () => {
    expect(previewMessage("Consulta breve.")).toBe("Consulta breve.")
    expect(previewMessage(`  Consulta\n\ncon   espacios  `)).toBe("Consulta con espacios")
    expect(previewMessage("x".repeat(100))).toBe("x".repeat(100))
    expect(previewMessage("x".repeat(101))).toBe(`${"x".repeat(100)}…`)
    expect(previewMessage("abc ".repeat(40))).toBe(`${"abc ".repeat(25).trimEnd()}…`)
  })

  it("compone la ubicación con los campos existentes del modelo", () => {
    expect(locationText({ city: "Guadalajara", country: "MX", postal_code: "44100" })).toBe(
      "Guadalajara, MX, 44100",
    )
    expect(locationText({ city: null, country: "MX", postal_code: null })).toBe("MX")
    expect(locationText({ city: null, country: null, postal_code: null })).toBe("—")
  })

  it("no inventa el apellido cuando el modelo lo guarda nulo", () => {
    expect(contactName({ first_name: "Ana", last_name: "Pérez" })).toBe("Ana Pérez")
    expect(contactName({ first_name: "Ana", last_name: null })).toBe("Ana")
  })

  it("etiqueta todas las acciones de auditoría que escribe el backend", () => {
    expect(Object.keys(CONTACT_AUDIT_LABELS).sort()).toEqual([
      "create",
      "delete",
      "note",
      "restore",
      "status",
      "update",
    ])
    expect(CONTACT_AUDIT_LABELS.update).toBe("Edición de datos")
    expect(CONTACT_AUDIT_LABELS.restore).toBe("Restauración")
  })

  it("distingue el estado eliminado del estado operativo", () => {
    expect(contactStatusLabel(contact)).toBe("Pendiente")
    expect(contactStatusLabel({ ...contact, status: "handled" })).toBe("Atendido")
    expect(contactStatusLabel({ ...contact, deleted_at: "2026-11-14T09:00:00.000Z" })).toBe(
      "Eliminado",
    )
  })

  it("formatea la fecha y evita romper con valores inválidos", () => {
    expect(formatDateTime(null)).toBe("—")
    expect(formatDateTime("no-es-fecha")).toBe("—")
    expect(formatDateTime("2026-11-13T10:15:00.000Z")).toMatch(/2026/)
  })

  it("valida email, teléfono y código postal antes de llamar a la API", () => {
    expect(validateContactDraft(contactDraftFrom(contact))).toEqual({})
    expect(
      validateContactDraft({
        ...contactDraftFrom(contact),
        first_name: " ",
        email: "sin-arroba",
        phone: "12ab",
        postal_code: "***",
      }),
    ).toEqual({
      first_name: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      postal_code: expect.any(String),
    })
  })

  it("acepta teléfonos y CP internacionales razonables", () => {
    expect(
      validateContactDraft({
        first_name: "Ana",
        last_name: "",
        email: "ana@example.test",
        phone: "+44 20 7946 0958",
        country: "GB",
        city: "London",
        postal_code: "SW1A 1AA",
      }),
    ).toEqual({})
    expect(
      validateContactDraft({
        first_name: "Ana",
        last_name: "",
        email: "ana@example.test",
        phone: "+52 33 1234 5678",
        country: "MX",
        city: "Guadalajara",
        postal_code: "44100",
      }),
    ).toEqual({})
  })

  it("solo construye el payload editable y normaliza los vacíos a nulo", () => {
    expect(
      contactUpdatePayload({
        first_name: "  Ana ",
        last_name: " ",
        email: " ANA@EXAMPLE.TEST ",
        phone: "",
        country: "MX",
        city: " Guadalajara ",
        postal_code: "44100",
      }),
    ).toEqual({
      first_name: "Ana",
      last_name: null,
      email: "ana@example.test",
      phone: null,
      country: "MX",
      city: "Guadalajara",
      postal_code: "44100",
    })
  })

  it("detecta solo IDs nuevos y posteriores al inicio de la sesión", () => {
    const since = new Date("2026-11-14T10:00:00.000Z").getTime()
    const fresh = { id: "req_new", created_at: "2026-11-14T10:00:05.000Z" }
    const old = { id: "req_old", created_at: "2026-11-13T10:00:00.000Z" }

    expect(newContactIds(null, [fresh], since)).toEqual(new Set())
    expect(newContactIds(new Set(["req_new"]), [fresh], since)).toEqual(new Set())
    expect(newContactIds(new Set(["req_old"]), [fresh, old], since)).toEqual(new Set(["req_new"]))
    expect(newContactIds(new Set(), [], since)).toEqual(new Set())
  })

  it("acumula vistos entre páginas sin perder los anteriores", () => {
    expect([...mergeSeenIds(new Set(["a"]), [{ id: "b" }, { id: "a" }])]).toEqual(["a", "b"])
  })

  it("usa X-Export-Count cuando existe y descarta valores inválidos", () => {
    expect(parseExportCount("12")).toBe(12)
    expect(parseExportCount(" 0 ")).toBe(0)
    expect(parseExportCount(null)).toBeNull()
    expect(parseExportCount("")).toBeNull()
    expect(parseExportCount("12 filas")).toBeNull()
    expect(parseExportCount("-3")).toBeNull()
  })
})
