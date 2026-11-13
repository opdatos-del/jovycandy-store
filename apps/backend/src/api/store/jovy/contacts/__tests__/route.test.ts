import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createContactWorkflow } from "@jovy/workflows/jovy-contacts/contact"

import { POST } from "../route"

jest.mock("@jovy/workflows/jovy-contacts/contact", () => ({
  createContactWorkflow: jest.fn(),
}))

const mockRun = jest.fn(async (_args: { input: Record<string, unknown> }) => ({ result: {} }))
;(createContactWorkflow as unknown as jest.Mock).mockReturnValue({ run: mockRun })

const payload = {
  first_name: "Ana",
  last_name: "Pérez",
  email: "ana@example.test",
  phone: "+52 55 0000 0000",
  country: "MX",
  city: "Ciudad de México",
  postal_code: "01000",
  message: "Solicitud DEMO privada.",
  contact_type: "customer-service",
}

type FakeResponse = {
  statusCode: number
  body: unknown
  headers: Record<string, string>
  status: (code: number) => FakeResponse
  json: (body: unknown) => FakeResponse
  setHeader: (name: string, value: string) => FakeResponse
}

function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      response.statusCode = code
      return response
    },
    json(body) {
      response.body = body
      return response
    },
    setHeader(name, value) {
      response.headers[name] = value
      return response
    },
  }
  return response
}

function fakeRequest(body: unknown, ip: string) {
  return { body, ip, scope: { resolve: () => ({}) } } as unknown as MedusaRequest
}

async function submit(body: unknown, ip: string) {
  const response = fakeResponse()
  await POST(fakeRequest(body, ip), response as unknown as MedusaResponse)
  return response
}

let ipSequence = 0
function uniqueIp() {
  ipSequence += 1
  return `198.51.100.${ipSequence}`
}

beforeEach(() => {
  mockRun.mockClear()
})

describe("POST /store/jovy/contacts", () => {
  it("acepta la solicitud con una respuesta genérica y persiste sin el honeypot", async () => {
    const response = await submit(payload, uniqueIp())

    expect(response.statusCode).toBe(202)
    expect(response.body).toEqual({ accepted: true })
    expect(mockRun).toHaveBeenCalledTimes(1)
    const { input } = mockRun.mock.calls[0][0]
    expect(input).not.toHaveProperty("website")
    expect(input).toMatchObject({ email: "ana@example.test", contact_type: "customer-service" })
  })

  it("responde 400 sin repetir los datos personales recibidos", async () => {
    const email = "privado@example.test"
    const message = "Mensaje privado que no debe volver al cliente"
    const consoleSpies = [jest.spyOn(console, "log"), jest.spyOn(console, "error"), jest.spyOn(console, "warn")]

    const response = await submit({ ...payload, email, message, campo_extra: message }, uniqueIp())

    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({ message: "La solicitud no es válida", errors: expect.anything() })
    const serialized = JSON.stringify(response.body)
    expect(serialized).not.toContain(email)
    expect(serialized).not.toContain(message)
    expect(serialized).not.toContain(payload.phone)
    expect(mockRun).not.toHaveBeenCalled()
    for (const spy of consoleSpies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(email)
      spy.mockRestore()
    }
  })

  it("rechaza campos no permitidos y tamaños excesivos", async () => {
    expect((await submit({ ...payload, admin_notes: "nota" }, uniqueIp())).statusCode).toBe(400)
    expect((await submit({ ...payload, message: "x".repeat(4_001) }, uniqueIp())).statusCode).toBe(400)
    expect((await submit({ ...payload, first_name: 7 }, uniqueIp())).statusCode).toBe(400)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it("acepta el honeypot sin persistir nada", async () => {
    const response = await submit({ ...payload, website: "https://spam.invalid" }, uniqueIp())

    expect(response.statusCode).toBe(202)
    expect(response.body).toEqual({ accepted: true })
    expect(mockRun).not.toHaveBeenCalled()
  })

  it("limita a cinco envíos por IP y anuncia cuándo reintentar", async () => {
    const ip = uniqueIp()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await submit(payload, ip)).statusCode).toBe(202)
    }

    const limited = await submit(payload, ip)

    expect(limited.statusCode).toBe(429)
    expect(limited.body).toEqual({ message: "No se puede procesar la solicitud en este momento" })
    expect(Number(limited.headers["Retry-After"])).toBeGreaterThan(0)
    expect(mockRun).toHaveBeenCalledTimes(5)
  })

  it("cuenta el honeypot dentro del límite de la IP", async () => {
    const ip = uniqueIp()
    for (let attempt = 0; attempt < 5; attempt += 1) await submit({ ...payload, website: "spam" }, ip)

    expect((await submit(payload, ip)).statusCode).toBe(429)
    expect(mockRun).not.toHaveBeenCalled()
  })
})
