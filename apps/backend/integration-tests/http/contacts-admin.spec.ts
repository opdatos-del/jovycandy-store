import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import type JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"

import { adminHeaders, createAdminSession } from "./utils"

jest.setTimeout(120_000)

type ContactListResponse = {
  contacts: Array<{ id: string; email: string; status: string; contact_type: string }>
  count: number
  limit: number
  offset: number
}

const SEED_CONTACTS = [
  {
    first_name: "Ana",
    last_name: "Nacional",
    email: "ana.nacional@example.test",
    message: "Consulta nacional de mayoreo.",
    contact_type: "national-sales",
    status: "handled",
  },
  {
    first_name: "Bruno",
    last_name: "Catálogo",
    email: "bruno.catalogo@example.test",
    message: "Solicitud de catálogo impreso.",
    contact_type: "catalogue",
    status: "pending",
  },
  {
    first_name: "Carla",
    last_name: "Servicio",
    email: "carla.servicio@example.test",
    message: "Duda de servicio al cliente.",
    contact_type: "customer-service",
    status: "pending",
  },
] as const

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-contacts-admin",
  testSuite: ({ api, getContainer }) => {
    let adminToken: string

    beforeAll(async () => {
      adminToken = await createAdminSession(getContainer(), api)
    })

    beforeEach(async () => {
      const contactsService = getContainer().resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService
      await contactsService.createJovyContactRequests(SEED_CONTACTS.map((contact) => ({ ...contact })))
    })

    const listContacts = (query: Record<string, string | number> = {}) =>
      api.get("/admin/jovy/contacts", {
        headers: adminHeaders(adminToken),
        params: query,
        validateStatus: () => true,
      })

    const listOk = async (query: Record<string, string | number> = {}) => {
      const response = await listContacts(query)
      expect(response.status).toBe(200)
      return response.data as ContactListResponse
    }

    it("exige una sesión de administrador", async () => {
      const response = await api.get("/admin/jovy/contacts", { validateStatus: () => true })

      expect(response.status).toBe(401)
    })

    it("devuelve el envelope paginado con los valores por defecto", async () => {
      const body = await listOk()

      expect(Object.keys(body).sort()).toEqual(["contacts", "count", "limit", "offset"])
      expect(body.count).toBe(3)
      expect(body.limit).toBe(20)
      expect(body.offset).toBe(0)
      expect(body.contacts).toHaveLength(3)
      expect(body.contacts.map((contact) => contact.email).sort()).toEqual(
        SEED_CONTACTS.map((contact) => contact.email).sort(),
      )
    })

    it("pagina con páginas disjuntas y conserva el total", async () => {
      const firstPage = await listOk({ limit: 2, offset: 0 })
      const secondPage = await listOk({ limit: 1, offset: 2 })

      expect(firstPage.contacts).toHaveLength(2)
      expect(secondPage.contacts).toHaveLength(1)
      expect(firstPage.count).toBe(3)
      expect(secondPage.count).toBe(3)

      const ids = [...firstPage.contacts, ...secondPage.contacts].map((contact) => contact.id)
      expect(new Set(ids).size).toBe(3)
    })

    it("filtra por status y contact_type de forma combinada", async () => {
      const pending = await listOk({ status: "pending" })
      expect(pending.count).toBe(2)
      expect(pending.contacts.every((contact) => contact.status === "pending")).toBe(true)

      const catalogue = await listOk({ contact_type: "catalogue" })
      expect(catalogue.count).toBe(1)
      expect(catalogue.contacts[0].email).toBe("bruno.catalogo@example.test")

      const handledNational = await listOk({ status: "handled", contact_type: "national-sales" })
      expect(handledNational.count).toBe(1)
      expect(handledNational.contacts[0].email).toBe("ana.nacional@example.test")
    })

    it("busca por texto sin distinguir mayúsculas ni tratar comodines de LIKE como patrones", async () => {
      const byEmail = await listOk({ q: "CATALOGO@EXAMPLE" })
      expect(byEmail.contacts.map((contact) => contact.email)).toEqual(["bruno.catalogo@example.test"])

      const byType = await listOk({ q: "customer" })
      expect(byType.contacts.map((contact) => contact.email)).toEqual(["carla.servicio@example.test"])

      const literalWildcard = await listOk({ q: "%" })
      expect(literalWildcard.count).toBe(0)
    })

    it("rechaza filtros fuera del contrato", async () => {
      const tooLarge = await listContacts({ limit: 101 })
      expect(tooLarge.status).toBe(400)

      const unknownStatus = await listContacts({ status: "archived" })
      expect(unknownStatus.status).toBe(400)

      const unknownField = await listContacts({ email: "ana.nacional@example.test" })
      expect(unknownField.status).toBe(400)
    })
  },
})
