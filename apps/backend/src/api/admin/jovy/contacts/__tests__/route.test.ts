import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { GET as getContact, PUT as updateContact } from "../[id]/route"
import { GET as listContacts } from "../route"

type FakeResponse = {
  statusCode: number
  body: unknown
  sent: boolean
  status: (code: number) => FakeResponse
  json: (body: unknown) => FakeResponse
  send: () => FakeResponse
}

function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    body: undefined,
    sent: false,
    status(code) {
      response.statusCode = code
      return response
    },
    json(body) {
      response.body = body
      return response
    },
    send() {
      response.sent = true
      return response
    },
  }
  return response
}

const listContact = jest.fn()
const listAndCountContact = jest.fn()

function fakeRequest(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    params: {},
    body: {},
    scope: {
      resolve: () => ({
        listJovyContactRequests: listContact,
        listAndCountJovyContactRequests: listAndCountContact,
      }),
    },
    ...overrides,
  } as unknown as MedusaRequest
}

beforeEach(() => {
  listContact.mockReset().mockResolvedValue([])
  listAndCountContact.mockReset().mockResolvedValue([[], 0])
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

  it("convierte limit y offset y mantiene claves estables", async () => {
    const response = fakeResponse()
    await listContacts(fakeRequest({ query: { limit: "5", offset: "10" } }), response as unknown as MedusaResponse)

    expect(response.body).toMatchObject({ limit: 5, offset: 10 })
    expect(listAndCountContact).toHaveBeenCalledWith(
      {},
      { take: 5, skip: 10, order: { created_at: "DESC", id: "DESC" } },
    )
  })

  it("traduce los filtros de estado, tipo y búsqueda a la consulta del módulo", async () => {
    const response = fakeResponse()
    await listContacts(
      fakeRequest({ query: { status: "pending", contact_type: "catalogue", q: "ana" } }),
      response as unknown as MedusaResponse,
    )

    const [filters] = listAndCountContact.mock.calls[0]
    expect(filters).toMatchObject({ status: "pending", contact_type: "catalogue" })
    expect(filters.$or).toHaveLength(4)
    expect(response.statusCode).toBe(200)
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
  })
})
