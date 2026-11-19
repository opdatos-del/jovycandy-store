import ExcelJS from "exceljs"
import {
  CONTACT_EXPORT_HEADERS,
  CONTACT_EXPORT_MAX_ROWS,
  DEFAULT_CONTACT_PAGE_SIZE,
  MAX_CONTACT_PAGE_SIZE,
  contactCountsFromRows,
  contactExportAllFileName,
  contactExportAllQuerySchema,
  contactExportFileName,
  contactExportQuerySchema,
  contactInboxTotals,
  contactListFilters,
  contactListQuerySchema,
  contactListWithDeleted,
  emptyContactCounts,
  normalizeOptionalText,
  parseContactDate,
  parseContactTypesParam,
  publicContactSchema,
  toContactCsv,
} from "@jovy/lib/jovy/contacts"
import { toContactXlsxBuffer } from "@jovy/lib/jovy/contacts-xlsx"

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
    const parsed = contactListQuerySchema.parse({
      status: "pending",
      contact_type: "catalogue",
      q: " ana ",
      date_from: "2026-01-01",
      date_to: "2026-01-31",
      limit: "50",
      offset: "10",
    })
    expect(parsed).toMatchObject({
      status: "pending",
      contact_type: "catalogue",
      q: "ana",
      date_from: "2026-01-01",
      date_to: "2026-01-31",
      limit: 50,
      offset: 10,
    })
  })

  it("sólo admite las páginas 10/20/50 del histórico", () => {
    for (const limit of ["10", "20", "50"]) {
      expect(contactListQuerySchema.safeParse({ limit }).success).toBe(true)
    }
    for (const limit of ["1", "5", "25", "100", "0", "abc", "1.5"]) {
      expect(contactListQuerySchema.safeParse({ limit }).success).toBe(false)
    }
    expect(MAX_CONTACT_PAGE_SIZE).toBe(50)
  })

  it("valida las fechas ISO y el orden del rango", () => {
    expect(contactListQuerySchema.safeParse({ date_from: "2026-01-01" }).success).toBe(true)
    expect(contactListQuerySchema.safeParse({ date_from: "2026-01-01T10:00:00.000Z" }).success).toBe(true)
    for (const date_from of ["2026-02-31", "2026-13-01", "ayer", "01/01/2026", "2026-1-1"]) {
      expect(contactListQuerySchema.safeParse({ date_from }).success).toBe(false)
    }
    expect(contactListQuerySchema.safeParse({ date_from: "2026-02-01", date_to: "2026-01-01" }).success).toBe(false)
    expect(contactListQuerySchema.safeParse({ date_from: "2026-01-01", date_to: "2026-01-31" }).success).toBe(true)
  })

  it("parsea fechas de calendario en UTC y rechaza fechas imposibles", () => {
    expect(parseContactDate("2026-01-31")?.toISOString()).toBe("2026-01-31T00:00:00.000Z")
    expect(parseContactDate("2026-02-31")).toBeNull()
    expect(parseContactDate("no-es-fecha")).toBeNull()
  })

  it("rechaza valores inválidos y campos desconocidos", () => {
    for (const query of [
      { offset: "-1" },
      { offset: "x" },
      { status: "archivado" },
      { contact_type: "otro" },
      { q: "x".repeat(101) },
      { q: "" },
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

  it("la papelera filtra por borrado lógico y activa withDeleted", () => {
    const deleted = contactListFilters({ status: "deleted" })
    expect(deleted).toEqual({ deleted_at: { $ne: null } })
    expect(contactListWithDeleted({ status: "deleted" })).toBe(true)
    expect(contactListWithDeleted({ status: "pending" })).toBe(false)
    expect(contactListWithDeleted({})).toBe(false)
    // `deleted` nunca se traduce a la columna status, que sólo guarda pending/handled.
    expect(deleted).not.toHaveProperty("status")
  })

  it("traduce el rango de fechas a created_at con el día completo", () => {
    const filters = contactListFilters({ date_from: "2026-01-01", date_to: "2026-01-31" }) as {
      created_at: { $gte: Date; $lte: Date }
    }
    expect(filters.created_at.$gte.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(filters.created_at.$lte.toISOString()).toBe("2026-01-31T23:59:59.999Z")
  })

  it("respeta un timestamp ISO completo como límite superior", () => {
    const filters = contactListFilters({ date_to: "2026-01-31T10:30:00.000Z" }) as { created_at: { $lte: Date } }
    expect(filters.created_at.$lte.toISOString()).toBe("2026-01-31T10:30:00.000Z")
  })

  it("combina la búsqueda con estado, tipo y fechas en la misma consulta", () => {
    expect(
      contactListFilters({ q: "ana", status: "handled", contact_type: "catalogue", date_from: "2026-01-01" }),
    ).toMatchObject({
      status: "handled",
      contact_type: "catalogue",
      created_at: { $gte: expect.any(Date) },
    })
  })

  it("busca en SQL sobre nombre, apellido, email, teléfono, ciudad, país, CP y tipo", () => {
    const filters = contactListFilters({ q: "ana" }) as { $or: Array<Record<string, { $ilike: string }>> }
    const fields = filters.$or.map((clause) => Object.keys(clause)[0])
    expect(fields).toEqual([
      "first_name",
      "last_name",
      "email",
      "phone",
      "city",
      "country",
      "postal_code",
      "contact_type",
    ])
    for (const clause of filters.$or) expect(Object.values(clause)[0].$ilike).toBe("%ana%")
  })

  it("tolera separadores en la búsqueda de teléfono sin abrir comodines", () => {
    const filters = contactListFilters({ q: "55 0000-1" }) as { $or: Array<Record<string, { $ilike: string }>> }
    const phone = filters.$or.find((clause) => "phone" in clause)?.phone.$ilike
    expect(phone).toBe("%55%0000%1%")
    // El resto de columnas mantiene el término literal.
    expect(filters.$or[0].first_name.$ilike).toBe("%55 0000-1%")
  })

  it("encuentra un teléfono escrito sin separadores", () => {
    const filters = contactListFilters({ q: "5512345678" }) as { $or: Array<Record<string, { $ilike: string }>> }
    const phone = filters.$or.find((clause) => "phone" in clause)?.phone.$ilike
    expect(phone).toBe("%5%5%1%2%3%4%5%6%7%8%")
  })

  it("escapa los comodines de LIKE", () => {
    const filters = contactListFilters({ q: "100%_x\\y" }) as { $or: Array<Record<string, { $ilike: string }>> }
    expect(filters.$or[0].first_name.$ilike).toBe("%100\\%\\_x\\\\y%")
  })

  it("valida el tipo en el servidor y no confía en el frontend", () => {
    expect(contactListQuerySchema.safeParse({ contact_type: "national-sales" }).success).toBe(true)
    for (const contact_type of ["National-Sales", "ventas", "", "catalogue "]) {
      expect(contactListQuerySchema.safeParse({ contact_type }).success).toBe(false)
    }
  })
})

describe("normalización de campos editables", () => {
  it("convierte vacíos en null y respeta undefined", () => {
    expect(normalizeOptionalText("  ")).toBeNull()
    expect(normalizeOptionalText("")).toBeNull()
    expect(normalizeOptionalText(" Ana ")).toBe("Ana")
    expect(normalizeOptionalText(null)).toBeNull()
    expect(normalizeOptionalText(undefined)).toBeUndefined()
  })
})

describe("exportación CSV", () => {
  const row = {
    id: "req_01",
    contact_type: "national-sales",
    first_name: "Ana",
    last_name: "Pérez",
    email: "ana@example.test",
    phone: "+52 55 0000 0000",
    country: "MX",
    city: "Ciudad de México",
    postal_code: "01000",
    message: "Hola, necesito \"precios\"",
    created_at: new Date("2026-01-02T03:04:05.000Z"),
  }

  it("exige la bandeja y acepta csv o xlsx", () => {
    expect(contactExportQuerySchema.safeParse({ contact_type: "catalogue" }).success).toBe(true)
    expect(contactExportQuerySchema.safeParse({ contact_type: "catalogue", format: "csv" }).success).toBe(true)
    expect(contactExportQuerySchema.safeParse({ contact_type: "catalogue", format: "xlsx" }).success).toBe(true)
    expect(contactExportQuerySchema.safeParse({}).success).toBe(false)
    expect(contactExportQuerySchema.safeParse({ contact_type: "otro" }).success).toBe(false)
    expect(contactExportQuerySchema.safeParse({ contact_type: "catalogue", format: "pdf" }).success).toBe(false)
    // La exportación no pagina: limit/offset no forman parte del contrato.
    expect(contactExportQuerySchema.safeParse({ contact_type: "catalogue", limit: "10" }).success).toBe(false)
  })

  it("valida el consolidado y la lista de bandejas", () => {
    expect(contactExportAllQuerySchema.safeParse({}).success).toBe(true)
    expect(contactExportAllQuerySchema.safeParse({ contact_types: "catalogue,national-sales" }).success).toBe(true)
    expect(contactExportAllQuerySchema.safeParse({ contact_types: "otro" }).success).toBe(false)
    expect(contactExportAllQuerySchema.safeParse({ contact_types: "catalogue", limit: "10" }).success).toBe(false)
    expect(contactExportAllQuerySchema.safeParse({
      contact_types: "catalogue",
      date_from: "2026-02-01",
      date_to: "2026-01-01",
    }).success).toBe(false)
  })

  it("normaliza contact_types sin duplicados y rechaza valores desconocidos", () => {
    expect(parseContactTypesParam(undefined)).toEqual([
      "national-sales",
      "international-sales",
      "customer-service",
      "catalogue",
    ])
    expect(parseContactTypesParam("")).toEqual([
      "national-sales",
      "international-sales",
      "customer-service",
      "catalogue",
    ])
    expect(parseContactTypesParam("catalogue, national-sales,catalogue")).toEqual([
      "catalogue",
      "national-sales",
    ])
    expect(parseContactTypesParam("otro")).toBeNull()
    expect(parseContactTypesParam(" , ")).toBeNull()
  })

  it("valida fechas y rango igual que el listado", () => {
    expect(contactExportQuerySchema.safeParse({ contact_type: "catalogue", date_from: "2026-01-01" }).success).toBe(true)
    expect(contactExportQuerySchema.safeParse({ contact_type: "catalogue", date_from: "2026-02-31" }).success).toBe(false)
    expect(
      contactExportQuerySchema.safeParse({
        contact_type: "catalogue",
        date_from: "2026-02-01",
        date_to: "2026-01-01",
      }).success,
    ).toBe(false)
  })

  it("emite BOM, cabeceras históricas y CRLF", () => {
    const csv = toContactCsv([row])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.split("\r\n")[0].replace(/^\ufeff/, "")).toBe(CONTACT_EXPORT_HEADERS.join(","))
    expect(csv).toContain("Ventas Nacional")
    expect(csv.endsWith("\r\n")).toBe(true)
  })

  it("escapa comas y comillas dobles", () => {
    const csv = toContactCsv([row])
    expect(csv).toContain('"Hola, necesito ""precios"""')
  })

  it("neutraliza fórmulas de hoja de cálculo", () => {
    const csv = toContactCsv([{ ...row, first_name: "=HYPERLINK(1)", city: "@cmd", phone: "-52 55" }])
    expect(csv).toContain("'=HYPERLINK(1)")
    expect(csv).toContain("'@cmd")
    expect(csv).toContain("'-52 55")
  })

  it("convierte CR en LF dentro de la celda para no romper filas", () => {
    const csv = toContactCsv([{ ...row, message: "linea1\r\nlinea2\rlinea3" }])
    expect(csv).toContain('"linea1\nlinea2\nlinea3"')
    expect(csv).not.toContain("\rlinea3")
  })

  it("nombra el archivo por bandeja y formato con tope de filas", () => {
    expect(contactExportFileName("customer-service", new Date("2026-05-06T00:00:00.000Z"), "csv")).toBe(
      "solicitudes-customer-service-2026-05-06.csv",
    )
    expect(contactExportFileName("customer-service", new Date("2026-05-06T00:00:00.000Z"), "xlsx")).toBe(
      "solicitudes-customer-service-2026-05-06.xlsx",
    )
    expect(contactExportAllFileName(new Date("2026-05-06T00:00:00.000Z"))).toBe(
      "solicitudes-consolidado-2026-05-06.xlsx",
    )
    expect(CONTACT_EXPORT_MAX_ROWS).toBeGreaterThan(0)
  })
})

describe("exportación XLSX", () => {
  const row = {
    id: "req_01",
    contact_type: "national-sales",
    first_name: "Ana",
    last_name: "Pérez",
    email: "ana@example.test",
    phone: "+52 55 0000 0000",
    country: "MX",
    city: "Ciudad de México",
    postal_code: "01000",
    message: "Hola, necesito precios",
    created_at: new Date("2026-01-02T03:04:05.000Z"),
  }

  it("genera un libro con una hoja por bandeja y las cabeceras históricas", async () => {
    const buffer = await toContactXlsxBuffer([
      { contactType: "national-sales", rows: [row] },
      { contactType: "catalogue", rows: [] },
    ])
    expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK")

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Ventas Nacional", "Catálogo"])

    const national = workbook.getWorksheet("Ventas Nacional")!
    CONTACT_EXPORT_HEADERS.forEach((header, index) => {
      expect(national.getRow(1).getCell(index + 1).value).toBe(header)
    })
    expect(national.rowCount).toBe(2)
    expect(national.getRow(2).getCell(1).value).toBe("req_01")
    expect(national.getRow(2).getCell(2).value).toBe("Ventas Nacional")
    expect(national.getRow(2).getCell(5).value).toBe("ana@example.test")
    expect(national.getRow(2).getCell(10).value).toBe("Hola, necesito precios")
    expect(national.getRow(2).getCell(11).value).toBe("2026-01-02T03:04:05.000Z")
    expect(workbook.getWorksheet("Catálogo")!.rowCount).toBe(1)
  })
})

describe("conteos por bandeja", () => {
  it("devuelve las cuatro bandejas en cero cuando no hay filas", () => {
    expect(emptyContactCounts()).toEqual({
      "national-sales": { pending: 0, handled: 0, deleted: 0, total: 0 },
      "international-sales": { pending: 0, handled: 0, deleted: 0, total: 0 },
      "customer-service": { pending: 0, handled: 0, deleted: 0, total: 0 },
      catalogue: { pending: 0, handled: 0, deleted: 0, total: 0 },
    })
  })

  it("agrupa las filas del backend y normaliza los conteos en texto de PostgreSQL", () => {
    const counts = contactCountsFromRows([
      { contact_type: "catalogue", status: "pending", count: "4" },
      { contact_type: "catalogue", status: "handled", count: 2 },
      { contact_type: "national-sales", status: "handled", count: "1" },
    ])

    expect(counts.catalogue).toEqual({ pending: 4, handled: 2, deleted: 0, total: 6 })
    expect(counts["national-sales"]).toEqual({ pending: 0, handled: 1, deleted: 0, total: 1 })
    expect(counts["international-sales"]).toEqual({ pending: 0, handled: 0, deleted: 0, total: 0 })
  })

  it("cuenta los borrados en su propio acumulador y no en el estado", () => {
    const counts = contactCountsFromRows([
      { contact_type: "catalogue", status: "pending", count: "1", deleted: false },
      { contact_type: "catalogue", status: "pending", count: "2", deleted: true },
      { contact_type: "catalogue", status: "handled", count: "1", deleted: "t" },
      { contact_type: "catalogue", status: "handled", count: "1", deleted: "f" },
    ])

    expect(counts.catalogue).toEqual({ pending: 1, handled: 1, deleted: 3, total: 5 })
  })

  it("ignora tipos, estados y conteos que el contrato no reconoce", () => {
    const counts = contactCountsFromRows([
      { contact_type: "otro", status: "pending", count: 9 },
      { contact_type: "catalogue", status: "archived", count: 9 },
      { contact_type: "catalogue", status: "pending", count: "no-es-numero" },
      { contact_type: "catalogue", status: "pending", count: -1 },
      { contact_type: "catalogue", status: "pending", count: "3" },
      { contact_type: "catalogue", status: "archived", count: "2", deleted: true },
    ])

    expect(counts.catalogue).toEqual({ pending: 3, handled: 0, deleted: 0, total: 3 })
    expect(Object.keys(counts)).toHaveLength(4)
    expect(counts).not.toHaveProperty("otro")
  })

  it("suma los totales globales para las pestañas", () => {
    const counts = contactCountsFromRows([
      { contact_type: "catalogue", status: "pending", count: "2" },
      { contact_type: "catalogue", status: "handled", count: "1" },
      { contact_type: "national-sales", status: "pending", count: "1", deleted: true },
    ])

    expect(contactInboxTotals(counts)).toEqual({ pending: 2, handled: 1, deleted: 1, total: 4 })
  })
})
