import { moduleIntegrationTestRunner, TestDatabaseUtils } from "@medusajs/test-utils"
import { contactAuditMetadata } from "@jovy/lib/jovy/audit"
import { contactListFilters } from "@jovy/lib/jovy/contacts"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import JovyContactAuditLog from "@jovy/modules/jovy-contacts/models/audit-log"
import JovyContactRequest from "@jovy/modules/jovy-contacts/models/contact-request"
import JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"

jest.setTimeout(60_000)

const TEST_DATABASE = "medusa-jovy-contacts-integration"

type ContactRow = { id: string; email: string; status: string; contact_type: string }

moduleIntegrationTestRunner<JovyContactsModuleService>({
  moduleName: JOVY_CONTACTS_MODULE,
  moduleModels: [JovyContactRequest, JovyContactAuditLog],
  resolve: "./src/modules/jovy-contacts",
  dbName: TEST_DATABASE,
  testSuite: ({ service }) => {
    beforeAll(async () => {
      // The module runner migrates the database but does not create it.
      await TestDatabaseUtils.dbTestUtilFactory().create(TEST_DATABASE)
    })

    afterAll(async () => {
      await TestDatabaseUtils.dbTestUtilFactory().shutdown(TEST_DATABASE)
    })

    let sequence = 0
    async function createContact(overrides: Partial<Record<string, unknown>> = {}) {
      sequence += 1
      return service.createJovyContactRequests({
        first_name: `Contacto${sequence}`,
        last_name: "Demo",
        email: `contacto${sequence}@example.test`,
        message: "Mensaje DEMO para pruebas de consulta.",
        contact_type: "customer-service",
        ...overrides,
      })
    }

    async function list(query: Parameters<typeof contactListFilters>[0], take?: number, skip = 0) {
      return service.listJovyContactRequests(contactListFilters(query), {
        take,
        skip,
        order: { created_at: "DESC", id: "DESC" },
      }) as unknown as ContactRow[]
    }

    describe("paginación estable", () => {
      it("devuelve páginas disjuntas y conserva el total", async () => {
        for (let index = 0; index < 25; index += 1) await createContact()

        const first = await list({}, 10, 0)
        const second = await list({}, 10, 10)
        const third = await list({}, 10, 20)
        const [, count] = await service.listAndCountJovyContactRequests({})

        expect(count).toBe(25)
        expect(first).toHaveLength(10)
        expect(second).toHaveLength(10)
        expect(third).toHaveLength(5)
        const ids = [...first, ...second, ...third].map((contact) => contact.id)
        expect(new Set(ids).size).toBe(25)
      })

      it("mantiene el mismo orden entre consultas", async () => {
        for (let index = 0; index < 5; index += 1) await createContact()

        const once = (await list({}, 5, 0)).map((contact) => contact.id)
        const twice = (await list({}, 5, 0)).map((contact) => contact.id)
        expect(twice).toEqual(once)
      })
    })

    describe("filtros", () => {
      it("filtra por estado y tipo en la base de datos", async () => {
        const handled = await createContact({ contact_type: "national-sales", status: "handled" })
        await createContact({ contact_type: "national-sales", status: "pending" })
        await createContact({ contact_type: "catalogue", status: "pending" })

        const byType = await list({ contact_type: "national-sales" })
        expect(byType).toHaveLength(2)

        const byStatus = await list({ status: "handled" })
        expect(byStatus.map((contact) => contact.id)).toEqual([handled.id])

        const both = await list({ status: "pending", contact_type: "catalogue" })
        expect(both).toHaveLength(1)
      })

      it("busca sin distinguir mayúsculas en nombre, email y tipo", async () => {
        const target = await createContact({
          first_name: "María",
          last_name: "Fernández",
          email: "maria@jovy.test",
          contact_type: "international-sales",
        })
        await createContact({ first_name: "Otro", email: "otro@jovy.test" })

        expect((await list({ q: "maría" })).map((contact) => contact.id)).toEqual([target.id])
        expect((await list({ q: "MARIA@JOVY" })).map((contact) => contact.id)).toEqual([target.id])
        expect((await list({ q: "fernández" })).map((contact) => contact.id)).toEqual([target.id])
        expect((await list({ q: "international" })).map((contact) => contact.id)).toEqual([target.id])
        expect(await list({ q: "inexistente" })).toHaveLength(0)
      })

      it("trata los comodines de LIKE como texto literal", async () => {
        const percent = await createContact({ first_name: "100% Natural" })
        await createContact({ first_name: "Otra persona" })

        const matches = await list({ q: "100%" })
        expect(matches.map((contact) => contact.id)).toEqual([percent.id])
        expect(await list({ q: "%" })).toHaveLength(1)
        expect(await list({ q: "_" })).toHaveLength(0)
      })
    })

    describe("borrado lógico", () => {
      it("deja de listar la solicitud sin borrar la fila", async () => {
        const contact = await createContact()
        await service.softDeleteJovyContactRequests(contact.id)

        expect(await list({})).toHaveLength(0)
        const rows = await service.listJovyContactRequests({ id: contact.id }, { withDeleted: true })
        expect(rows).toHaveLength(1)
      })
    })

    describe("auditoría", () => {
      it("persiste actor, acción y entidad sin datos personales", async () => {
        const contact = await createContact()
        await service.createJovyContactAuditLogs({
          actor_id: null,
          contact_request_id: contact.id,
          action: "create",
          metadata: contactAuditMetadata("create", contact),
        })
        await service.createJovyContactAuditLogs({
          actor_id: "usr_123",
          contact_request_id: contact.id,
          action: "status",
          metadata: contactAuditMetadata("status", { ...contact, status: "handled" }),
        })

        const logs = await service.listJovyContactAuditLogs({ contact_request_id: contact.id }, { order: { created_at: "ASC" } })
        expect(logs).toHaveLength(2)
        expect(logs[0]).toMatchObject({ actor_id: null, action: "create", contact_request_id: contact.id })
        expect(logs[0].metadata).toEqual({ contact_type: "customer-service", status: "pending" })
        expect(logs[1]).toMatchObject({ actor_id: "usr_123", action: "status", contact_request_id: contact.id })
        expect(logs[1].metadata).toEqual({ status: "handled" })

        const serialized = JSON.stringify(logs)
        expect(serialized).not.toContain(contact.email)
        expect(serialized).not.toContain(contact.message)
        expect(serialized).not.toContain(contact.first_name)
      })
    })
  },
})
