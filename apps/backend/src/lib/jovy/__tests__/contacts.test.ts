import {
  DEFAULT_CONTACT_PAGE_SIZE,
  MAX_CONTACT_PAGE_SIZE,
  contactListFilters,
  contactListQuerySchema,
  publicContactSchema,
} from "@jovy/lib/jovy/contacts"

const validPayload = {
  first_name: "  Ana  ",
  last_name: "Pérez",
  email: "  ANA@Example.TEST ",
  phone: "+52 55 0000 0000",
  country: "MX",
  city: "Ciudad de México",
  postal_code: "01000",
  message: "Solicitud DEMO con datos personales.",
  contact_type: "customer-service",
}

describe("intake público de contactos", () => {
  it("normaliza espacios y el email", () => {
    const parsed = publicContactSchema.parse(validPayload)
    expect(parsed.first_name).toBe("Ana")
    expect(parsed.email).toBe("ana@example.test")
    expect(parsed.website).toBe("")
  })

  it("rechaza campos no permitidos", () => {
    for (const extra of [
      { admin_notes: "nota interna" },
      { status: "handled" },
      { handled_by: "usr_123" },
      { contact_request_id: "req_123" },
      { id: "forzado" },
    ]) {
      expect(publicContactSchema.safeParse({ ...validPayload, ...extra }).success).toBe(false)
    }
  })

  it("rechaza tipos incorrectos y tamaños excesivos", () => {
    const invalid = [
      { ...validPayload, first_name: 42 },
      { ...validPayload, email: "no-es-un-email" },
      { ...validPayload, phone: { number: "+5255" } },
      { ...validPayload, message: "x".repeat(4_001) },
      { ...validPayload, first_name: "x".repeat(101) },
      { ...validPayload, email: `${"x".repeat(254)}@example.test` },
      { ...validPayload, contact_type: "otro" },
      { ...validPayload, website: "x".repeat(201) },
    ]
    for (const payload of invalid) expect(publicContactSchema.safeParse(payload).success).toBe(false)
  })

  it("no repite datos personales en el error de validación", () => {
    const email = "filtrado@example.test"
    const message = "Mensaje privado que no debe aparecer"
    const parsed = publicContactSchema.safeParse({ ...validPayload, email, message, campo_extra: message })

    expect(parsed.success).toBe(false)
    const serialized = JSON.stringify(parsed.error?.flatten())
    expect(serialized).not.toContain(email)
    expect(serialized).not.toContain(message)
    expect(serialized).not.toContain(validPayload.phone)
  })

  it("acepta el honeypot como campo opcional", () => {
    expect(publicContactSchema.safeParse({ ...validPayload, website: "https://spam.invalid" }).success).toBe(true)
  })
})

describe("consulta administrativa de contactos", () => {
  it("aplica paginación por defecto", () => {
    const parsed = contactListQuerySchema.parse({})
    expect(parsed.limit).toBe(DEFAULT_CONTACT_PAGE_SIZE)
    expect(parsed.offset).toBe(0)
  })

  it("convierte los parámetros de consulta y acepta los filtros", () => {
    const parsed = contactListQuerySchema.parse({ status: "pending", contact_type: "catalogue", q: " ana ", limit: "5", offset: "10" })
    expect(parsed).toEqual({ status: "pending", contact_type: "catalogue", q: "ana", limit: 5, offset: 10 })
  })

  it("limita el tamaño de página y rechaza valores inválidos", () => {
    expect(contactListQuerySchema.safeParse({ limit: String(MAX_CONTACT_PAGE_SIZE) }).success).toBe(true)
    for (const query of [
      { limit: String(MAX_CONTACT_PAGE_SIZE + 1) },
      { limit: "0" },
      { limit: "abc" },
      { limit: "1.5" },
      { offset: "-1" },
      { offset: "x" },
      { status: "archivado" },
      { contact_type: "otro" },
      { q: "x".repeat(101) },
      { desconocido: "1" },
    ]) {
      expect(contactListQuerySchema.safeParse(query).success).toBe(false)
    }
  })

  it("construye filtros de estado y tipo", () => {
    expect(contactListFilters({ status: "handled", contact_type: "national-sales" })).toEqual({
      status: "handled",
      contact_type: "national-sales",
    })
    expect(contactListFilters({})).toEqual({})
  })

  it("combina la búsqueda con estado y tipo en la misma consulta", () => {
    expect(contactListFilters({ q: "ana", status: "handled", contact_type: "catalogue" })).toMatchObject({
      status: "handled",
      contact_type: "catalogue",
      $or: [
        { first_name: { $ilike: "%ana%" } },
        { last_name: { $ilike: "%ana%" } },
        { email: { $ilike: "%ana%" } },
        { contact_type: { $ilike: "%ana%" } },
      ],
    })
  })

  it("busca en SQL sobre nombre, email y tipo", () => {
    const filters = contactListFilters({ q: "ana" }) as { $or: Array<Record<string, { $ilike: string }>> }
    expect(filters.$or).toHaveLength(4)
    expect(filters.$or.map((clause) => Object.keys(clause)[0])).toEqual(["first_name", "last_name", "email", "contact_type"])
    for (const clause of filters.$or) expect(Object.values(clause)[0].$ilike).toBe("%ana%")
  })

  it("escapa los comodines de LIKE", () => {
    const filters = contactListFilters({ q: "100%_x\\y" }) as { $or: Array<Record<string, { $ilike: string }>> }
    expect(filters.$or[0].first_name.$ilike).toBe("%100\\%\\_x\\\\y%")
  })
})
