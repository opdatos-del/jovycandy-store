import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import { adminHeaders, createAdminSession, createPublishableApiKey, storeHeaders } from "./utils"

jest.setTimeout(120_000)

const CONTACT = {
  first_name: "Ana",
  last_name: "Pérez",
  phone: "+52 55 1234 5678",
  country: "MX",
  city: "Ciudad de México",
  postal_code: "01000",
  message: "Solicitud de catálogo mayorista.",
  contact_type: "catalogue",
} as const

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-contacts-store",
  testSuite: ({ api, getContainer }) => {
    let publishableApiKey: string
    let adminToken: string

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
      adminToken = await createAdminSession(getContainer(), api)
    })

    const submitContact = (body: Record<string, unknown>) =>
      api.post("/store/jovy/contacts", body, {
        headers: storeHeaders(publishableApiKey),
        validateStatus: () => true,
      })

    const listContacts = async (query: Record<string, string>) => {
      const response = await api.get("/admin/jovy/contacts", {
        headers: adminHeaders(adminToken),
        params: query,
      })
      return response.data as {
        contacts: Array<Record<string, unknown>>
        count: number
        limit: number
        offset: number
      }
    }

    it("responde 202 con un acuse genérico y persiste la solicitud normalizada", async () => {
      const email = "store.contact@example.test"

      const response = await submitContact({ ...CONTACT, email: email.toUpperCase() })

      expect(response.status).toBe(202)
      expect(response.data).toEqual({ accepted: true })

      const listed = await listContacts({ q: email })
      expect(listed.count).toBe(1)
      expect(listed.contacts[0]).toMatchObject({
        email,
        contact_type: "catalogue",
        status: "pending",
        message: CONTACT.message,
      })
    })

    it("responde 400 sin devolver ni persistir los datos personales enviados", async () => {
      const email = "correo-privado-invalido"
      const phone = "+52 55 0000 9999"
      const message = "Mensaje privado que no debe volver al cliente"

      const response = await submitContact({ ...CONTACT, email, phone, message, campo_extra: message })

      expect(response.status).toBe(400)
      expect(response.data).toEqual({ message: "La solicitud no es válida", errors: expect.anything() })

      const serialized = JSON.stringify(response.data)
      expect(serialized).not.toContain(email)
      expect(serialized).not.toContain(phone)
      expect(serialized).not.toContain(message)

      const listed = await listContacts({ q: email })
      expect(listed.count).toBe(0)
    })

    it("rechaza payloads fuera de los límites del contrato", async () => {
      const invalidPayloads = [
        { ...CONTACT, email: "sin-arroba" },
        { ...CONTACT, message: "x".repeat(4_001) },
        { ...CONTACT, contact_type: "otro-tipo" },
        { ...CONTACT, first_name: "" },
        { ...CONTACT, admin_notes: "campo no permitido" },
      ]

      for (const payload of invalidPayloads) {
        const response = await submitContact(payload)
        expect(response.status).toBe(400)
        expect(response.data).toEqual({ message: "La solicitud no es válida", errors: expect.anything() })
      }

      const listed = await listContacts({ limit: "100" })
      expect(listed.count).toBe(0)
    })

    it("acepta el honeypot con 202 y no persiste la solicitud", async () => {
      const email = "honeypot.bot@example.test"

      const response = await submitContact({ ...CONTACT, email, website: "https://spam.invalid" })

      expect(response.status).toBe(202)
      expect(response.data).toEqual({ accepted: true })

      const listed = await listContacts({ q: email })
      expect(listed.count).toBe(0)
    })
  },
})
