import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import { restoreContactWorkflow, updateContactWorkflow } from "@jovy/workflows/jovy-contacts/contact"

import { GET as getContact, PUT as updateContact } from "../[id]/route"
import { POST as restoreContact } from "../[id]/restore/route"
import { GET as getCounts } from "../counts/route"
import { GET as exportContacts } from "../export/route"
import { GET as listContacts } from "../route"

jest.mock("@jovy/workflows/jovy-contacts/contact", () => ({
  updateContactWorkflow: jest.fn(),
  deleteContactWorkflow: jest.fn(),
  restoreContactWorkflow: jest.fn(),
}))

type FakeResponse = {
  statusCode: number
  body: unknown
  sent: boolean
  headers: Record<string, string>
  status: (code: number) => FakeResponse
  json: (body: unknown) => FakeResponse
  send: (body?: unknown) => FakeResponse
  setHeader: (name: string, value: string) => FakeResponse
}

function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    body: undefined,
    sent: false,
    headers: {},
    status(code) {
      response.statusCode = code
      return response
    },
    json(body) {
      response.body = body
      return response
    },
    send(body) {
      response.body = body
      response.sent = true
      return response
    },
    setHeader(name, value) {
      response.headers[name] = value
      return response
    },
  }
  return response
}

const listContact = jest.fn()
const listAndCountContact = jest.fn()
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
let knex: jest.Mock

function fakeRequest(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    params: {},
    body: {},
    scope: {
      resolve: (key: string) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION) return knex
        if (key === ContainerRegistrationKeys.LOGGER) return logger
        if (key === JOVY_CONTACTS_MODULE) {
          return {
            listJovyContactRequests: listContact,
            listAndCountJovyContactRequests: listAndCountContact,
          }
        }
        throw new Error(`registro no simulado: ${key}`)
      },
    },
    ...overrides,
  } as unknown as MedusaRequest
}

beforeEach(() => {
  listContact.mockReset().mockResolvedValue([])
  listAndCountContact.mockReset().mockResolvedValue([[], 0])
  logger.info.mockReset()
  logger.warn.mockReset()
  logger.error.mockReset()
  jest.mocked(restoreContactWorkflow).mockReset()
  jest.mocked(updateContactWorkflow).mockReset()
})

describe("GET /admin/jovy/contacts", () => {
  it("pagina con valores por defecto y devuelve el total", async () => {
    const contacts = [{ id: "req_01" }]
    listAndCountContact.mockResolvedValue([contacts, 1])

    const response = fakeResponse()
    await listContacts(fakeRequest(), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ contacts, count: 1, limit: 20, offset: 0 })
    expect(listAndCountContact).toHaveBeenCalledWith(
      {},
      { take: 20, skip: 0, order: { created_at: "DESC", id: "DESC" } },
    )
  })

  it("acepta las páginas del histórico y offset", async () => {
    const response = fakeResponse()
    await listContacts(
      fakeRequest({ query: { limit: "50", offset: "10" } }),
      response as unknown as MedusaResponse,
    )

    expect(response.body).toMatchObject({ limit: 50, offset: 10 })
    expect(listAndCountContact).toHaveBeenCalledWith(
      {},
      { take: 50, skip: 10, order: { created_at: "DESC", id: "DESC" } },
    )
  })

  it("traduce los filtros de estado, tipo, búsqueda y fechas a la consulta del módulo", async () => {
    const response = fakeResponse()
    await listContacts(
      fakeRequest({
        query: {
          status: "pending",
          contact_type: "catalogue",
          q: "ana",
          date_from: "2026-01-01",
          date_to: "2026-01-31",
        },
      }),
      response as unknown as MedusaResponse,
    )

    const [filters, config] = listAndCountContact.mock.calls[0]
    expect(filters).toMatchObject({
      status: "pending",
      contact_type: "catalogue",
      created_at: { $gte: expect.any(Date), $lte: expect.any(Date) },
    })
    expect(filters.$or).toHaveLength(8)
    expect(config).not.toHaveProperty("withDeleted")
    expect(response.statusCode).toBe(200)
  })

  it("lee borrados sólo en la vista de papelera", async () => {
    const response = fakeResponse()
    await listContacts(
      fakeRequest({ query: { status: "deleted" } }),
      response as unknown as MedusaResponse,
    )

    const [filters, config] = listAndCountContact.mock.calls[0]
    expect(filters).toEqual({ deleted_at: { $ne: null } })
    expect(config).toMatchObject({ withDeleted: true })
  })

  it("rechaza páginas fuera de 10/20/50 sin consultar el módulo", async () => {
    const response = fakeResponse()
    await listContacts(fakeRequest({ query: { limit: "25" } }), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({ message: "Los filtros no son válidos" })
    expect(listAndCountContact).not.toHaveBeenCalled()
  })

  it("rechaza fechas inválidas o un rango invertido", async () => {
    for (const query of [
      { date_from: "2026-02-31" },
      { date_to: "ayer" },
      { date_from: "2026-02-01", date_to: "2026-01-01" },
    ]) {
      const response = fakeResponse()
      await listContacts(fakeRequest({ query }), response as unknown as MedusaResponse)
      expect(response.statusCode).toBe(400)
    }
    expect(listAndCountContact).not.toHaveBeenCalled()
  })

  it("rechaza parámetros inválidos sin repetir lo recibido", async () => {
    const query = { q: "x".repeat(101), limit: "999" }
    const response = fakeResponse()
    await listContacts(fakeRequest({ query }), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({ message: "Los filtros no son válidos" })
    expect(JSON.stringify(response.body)).not.toContain(query.q)
    expect(listAndCountContact).not.toHaveBeenCalled()
  })

  it("rechaza parámetros desconocidos", async () => {
    const response = fakeResponse()
    await listContacts(fakeRequest({ query: { email: "ana@example.test" } }), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(400)
    expect(JSON.stringify(response.body)).not.toContain("ana@example.test")
  })

  it("rechaza un contact_type fuera del enum sin consultar el módulo", async () => {
    const response = fakeResponse()
    await listContacts(
      fakeRequest({ query: { contact_type: "national-sales;drop table jovy_contact_request" } }),
      response as unknown as MedusaResponse,
    )

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({ message: "Los filtros no son válidos" })
    expect(listAndCountContact).not.toHaveBeenCalled()
  })
})

describe("GET /admin/jovy/contacts/:id", () => {
  it("responde 404 sin repetir el identificador solicitado", async () => {
    const response = fakeResponse()
    await getContact(fakeRequest({ params: { id: "ana@example.test" } }), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(404)
    expect(response.body).toEqual({ message: "Solicitud no encontrada" })
  })

  it("devuelve la solicitud encontrada", async () => {
    const contact = { id: "req_01", email: "ana@example.test" }
    listContact.mockResolvedValue([contact])
    const response = fakeResponse()

    await getContact(fakeRequest({ params: { id: "req_01" } }), response as unknown as MedusaResponse)

    expect(response.body).toEqual({ contact })
  })
})

describe("PUT /admin/jovy/contacts/:id", () => {
  it("rechaza el cuerpo inválido antes de leer la solicitud", async () => {
    const response = fakeResponse()
    await updateContact(
      fakeRequest({ params: { id: "req_01" }, body: { email: "ana@example.test", status: "veleta" } }),
      response as unknown as MedusaResponse,
    )

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({ message: "La actualización no es válida" })
    expect(JSON.stringify(response.body)).not.toContain("ana@example.test")
    expect(listContact).not.toHaveBeenCalled()
    expect(updateContactWorkflow).not.toHaveBeenCalled()
  })

  it("rechaza contact_type, id y campos no permitidos", async () => {
    for (const body of [
      { contact_type: "catalogue" },
      { id: "req_99" },
      { message: "otro mensaje" },
      { deleted_at: null },
      { handled_by: "usr_123" },
    ]) {
      const response = fakeResponse()
      await updateContact(
        fakeRequest({ params: { id: "req_01" }, body }),
        response as unknown as MedusaResponse,
      )
      expect(response.statusCode).toBe(400)
    }
    expect(listContact).not.toHaveBeenCalled()
  })

  it("envía los campos del solicitante al workflow con el actor autenticado", async () => {
    listContact.mockResolvedValue([{ id: "req_01" }])
    const run = jest.fn(async ({ input }: { input: Record<string, unknown> }) => ({ result: { id: input.id } }))
    jest.mocked(updateContactWorkflow).mockReturnValue({ run } as never)

    const response = fakeResponse()
    await updateContact(
      fakeRequest({
        params: { id: "req_01" },
        auth_context: { actor_id: "usr_123" },
        body: {
          first_name: "Ana",
          last_name: "Pérez",
          email: "ANA@Example.TEST",
          phone: "+52 55 0000 0000",
          city: "Ciudad de México",
          country: "MX",
          postal_code: "01000",
          status: "handled",
          admin_notes: "Llamar por la tarde",
        },
      }),
      response as unknown as MedusaResponse,
    )

    expect(response.statusCode).toBe(200)
    expect(run).toHaveBeenCalledWith({
      input: expect.objectContaining({
        id: "req_01",
        email: "ana@example.test",
        first_name: "Ana",
        status: "handled",
        actor_id: "usr_123",
      }),
    })
  })
})

describe("POST /admin/jovy/contacts/:id/restore", () => {
  it("responde 404 sin escribir auditoría cuando la solicitud no existe", async () => {
    listContact.mockResolvedValue([])
    const response = fakeResponse()

    await restoreContact(fakeRequest({ params: { id: "req_404" } }), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(404)
    expect(response.body).toEqual({ message: "Solicitud no encontrada" })
    expect(restoreContactWorkflow).not.toHaveBeenCalled()
  })

  it("busca con withDeleted y delega en el workflow idempotente", async () => {
    const contact = { id: "req_01", deleted_at: new Date() }
    listContact.mockResolvedValue([contact])
    const run = jest.fn(async () => ({ result: { id: "req_01", deleted_at: null } }))
    jest.mocked(restoreContactWorkflow).mockReturnValue({ run } as never)

    const response = fakeResponse()
    await restoreContact(
      fakeRequest({ params: { id: "req_01" }, auth_context: { actor_id: "usr_123" } }),
      response as unknown as MedusaResponse,
    )

    expect(listContact).toHaveBeenCalledWith({ id: "req_01" }, { withDeleted: true })
    expect(run).toHaveBeenCalledWith({ input: { id: "req_01", actor_id: "usr_123" } })
    expect(response.body).toEqual({ contact: { id: "req_01", deleted_at: null } })
  })
})

type FakeCountBuilder = {
  select: jest.Mock
  count: jest.Mock
  groupBy: jest.Mock
}

function fakeCountsRequest(rows: Array<Record<string, unknown>>) {
  const builder = {} as FakeCountBuilder
  builder.select = jest.fn(() => builder)
  builder.count = jest.fn(() => builder)
  builder.groupBy = jest.fn(() => Promise.resolve(rows))
  const raw = jest.fn((sql: string) => ({ sql }))
  knex = jest.fn(() => builder) as unknown as jest.Mock
  ;(knex as unknown as { raw: jest.Mock }).raw = raw

  return {
    request: fakeRequest(),
    knex,
    builder,
    raw,
  }
}

describe("GET /admin/jovy/contacts/counts", () => {
  it("agrega en SQL por tipo, estado y borrado lógico", async () => {
    const { request, knex: db, builder, raw } = fakeCountsRequest([
      { contact_type: "catalogue", status: "pending", count: "2", deleted: false },
      { contact_type: "catalogue", status: "handled", count: "1", deleted: false },
      { contact_type: "catalogue", status: "pending", count: "1", deleted: true },
    ])
    const response = fakeResponse()

    await getCounts(request, response as unknown as MedusaResponse)

    expect(db).toHaveBeenCalledWith("jovy_contact_request")
    expect(raw).toHaveBeenCalledWith("(deleted_at is not null) as deleted")
    expect(builder.groupBy).toHaveBeenCalledWith("contact_type", "status", { sql: "(deleted_at is not null)" })
    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      counts: {
        "national-sales": { pending: 0, handled: 0, deleted: 0, total: 0 },
        "international-sales": { pending: 0, handled: 0, deleted: 0, total: 0 },
        "customer-service": { pending: 0, handled: 0, deleted: 0, total: 0 },
        catalogue: { pending: 2, handled: 1, deleted: 1, total: 4 },
      },
      totals: { pending: 2, handled: 1, deleted: 1, total: 4 },
    })
  })

  it("no devuelve identificadores ni datos personales", async () => {
    const { request } = fakeCountsRequest([{ contact_type: "catalogue", status: "pending", count: "1" }])
    const response = fakeResponse()

    await getCounts(request, response as unknown as MedusaResponse)

    expect(Object.keys(response.body as object)).toEqual(["counts", "totals"])
    expect(JSON.stringify(response.body)).not.toContain("@")
  })
})

const exportRow = {
  id: "req_01",
  contact_type: "catalogue",
  first_name: "Ana",
  last_name: "Pérez",
  email: "ana@example.test",
  phone: "+52 55 0000 0000",
  country: "MX",
  city: "Ciudad de México",
  postal_code: "01000",
  message: 'Hola, "catálogo"',
  created_at: new Date("2026-01-02T03:04:05.000Z"),
}

describe("GET /admin/jovy/contacts/export", () => {
  it("exige la bandeja y rechaza formatos distintos de csv", async () => {
    for (const query of [{}, { contact_type: "otro" }, { contact_type: "catalogue", format: "xlsx" }, { contact_type: "catalogue", limit: "10" }]) {
      const response = fakeResponse()
      await exportContacts(fakeRequest({ query }), response as unknown as MedusaResponse)
      expect(response.statusCode).toBe(400)
    }
    expect(listContact).not.toHaveBeenCalled()
  })

  it("exporta sólo la bandeja pedida con BOM y cabeceras históricas", async () => {
    listContact.mockResolvedValue([exportRow])
    const response = fakeResponse()

    await exportContacts(
      fakeRequest({ query: { contact_type: "catalogue", status: "handled", date_from: "2026-01-01" } }),
      response as unknown as MedusaResponse,
    )

    const [filters, config] = listContact.mock.calls[0]
    expect(filters).toMatchObject({ contact_type: "catalogue", status: "handled", created_at: { $gte: expect.any(Date) } })
    expect(config).toMatchObject({ take: 5_001, order: { created_at: "DESC", id: "DESC" } })
    expect(config).not.toHaveProperty("withDeleted")

    const csv = response.body as string
    expect(response.statusCode).toBe(200)
    expect(response.headers["Content-Type"]).toBe("text/csv; charset=utf-8")
    expect(response.headers["Content-Disposition"]).toMatch(/^attachment; filename="solicitudes-catalogue-\d{4}-\d{2}-\d{2}\.csv"$/)
    expect(response.headers["Cache-Control"]).toBe("no-store")
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain("ID,Tipo,Nombre,Apellido,Email,Teléfono,País,Ciudad,CP,Mensaje,Creado")
    expect(csv).toContain('"Hola, ""catálogo"""')
    expect(response.headers["X-Export-Count"]).toBe("1")
  })

  it("informa X-Export-Count con registros y no con líneas del CSV", async () => {
    const multiline = {
      ...exportRow,
      id: "req_02",
      email: "bruno@example.test",
      message: "Primera línea\nSegunda línea, con coma y \"comillas\".",
    }
    listContact.mockResolvedValue([exportRow, multiline])
    const response = fakeResponse()

    await exportContacts(
      fakeRequest({ query: { contact_type: "catalogue" } }),
      response as unknown as MedusaResponse,
    )

    const csv = response.body as string
    expect(response.headers["X-Export-Count"]).toBe("2")
    // El BOM se conserva y el mensaje multilínea sigue correctamente entrecomillado.
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"Primera línea\nSegunda línea, con coma y ""comillas""."')
    // El conteo visible por líneas físicas sería mayor que los registros reales.
    const visualLines = csv.replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/)
    expect(visualLines.length - 1).toBe(3)
  })

  it("incluye la papelera sólo cuando se pide y lo audita sin PII", async () => {
    listContact.mockResolvedValue([])
    const q = "ana@example.test"
    const response = fakeResponse()

    await exportContacts(
      fakeRequest({ query: { contact_type: "catalogue", status: "deleted", q }, auth_context: { actor_id: "usr_123" } }),
      response as unknown as MedusaResponse,
    )

    const [filters, config] = listContact.mock.calls[0]
    expect(filters).toMatchObject({ contact_type: "catalogue", deleted_at: { $ne: null } })
    expect(config).toMatchObject({ withDeleted: true })

    expect(logger.info).toHaveBeenCalledTimes(1)
    const logged = JSON.stringify(logger.info.mock.calls[0])
    expect(logged).toContain("usr_123")
    expect(logged).toContain("catalogue")
    expect(logged).not.toContain(q)
    expect(logged).not.toContain("@")
  })

  it("no exporta por encima del tope y lo informa sin filtrar datos", async () => {
    listContact.mockResolvedValue(Array.from({ length: 5_001 }, () => exportRow))
    const response = fakeResponse()

    await exportContacts(
      fakeRequest({ query: { contact_type: "catalogue" } }),
      response as unknown as MedusaResponse,
    )

    expect(response.statusCode).toBe(400)
    expect(response.body).toMatchObject({ message: expect.stringContaining("5000") })
    expect(logger.info).not.toHaveBeenCalled()
    expect(JSON.stringify(response.body)).not.toContain(exportRow.email)
  })
})
