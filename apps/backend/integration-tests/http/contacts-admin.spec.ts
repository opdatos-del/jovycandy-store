import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import type JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"

import { adminHeaders, createAdminSession } from "./utils"

jest.setTimeout(120_000)

type ContactListResponse = {
  contacts: Array<{
    id: string
    email: string
    status: string
    contact_type: string
    deleted_at?: string | null
  }>
  count: number
  limit: number
  offset: number
}

const SEED_CONTACTS = [
  {
    first_name: "Ana",
    last_name: "Nacional",
    email: "ana.nacional@example.test",
    phone: "+52 55 1111 2222",
    city: "Ciudad de México",
    country: "México",
    postal_code: "01000",
    message: "Consulta nacional de mayoreo.",
    contact_type: "national-sales",
    status: "handled",
  },
  {
    first_name: "Bruno",
    last_name: "Catálogo",
    email: "bruno.catalogo@example.test",
    phone: "+52 33 3333 4444",
    city: "Guadalajara",
    country: "México",
    postal_code: "44100",
    message: "Solicitud de catálogo impreso.",
    contact_type: "catalogue",
    status: "pending",
  },
  {
    first_name: "Carla",
    last_name: "Servicio",
    email: "carla.servicio@example.test",
    phone: "+1 415 555 6666",
    city: "Austin",
    country: "Estados Unidos",
    postal_code: "73301",
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

    const contactsService = () => getContainer().resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService

    beforeAll(async () => {
      adminToken = await createAdminSession(getContainer(), api)
    })

    beforeEach(async () => {
      await contactsService().createJovyContactRequests(SEED_CONTACTS.map((contact) => ({ ...contact })))
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

    const exportContacts = (query: Record<string, string | number> = {}) =>
      api.get("/admin/jovy/contacts/export", {
        headers: adminHeaders(adminToken),
        params: query,
        // The BOM is stripped by axios text decoding, so the bytes are checked.
        responseType: "arraybuffer",
        validateStatus: () => true,
      })

    const csvText = (response: { data: Buffer | string }) =>
      Buffer.from(response.data).toString("utf8").replace(/^\uFEFF/, "")

    const getCounts = () =>
      api.get("/admin/jovy/contacts/counts", { headers: adminHeaders(adminToken) })

    it("exige una sesión de administrador", async () => {
      const response = await api.get("/admin/jovy/contacts", { validateStatus: () => true })
      const counts = await api.get("/admin/jovy/contacts/counts", { validateStatus: () => true })
      const exportResponse = await api.get("/admin/jovy/contacts/export", { validateStatus: () => true })
      const restore = await api.post(
        "/admin/jovy/contacts/req_123/restore",
        {},
        { validateStatus: () => true },
      )

      expect(response.status).toBe(401)
      expect(counts.status).toBe(401)
      expect(exportResponse.status).toBe(401)
      expect(restore.status).toBe(401)
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

    it("pagina con las páginas del histórico y conserva el total", async () => {
      const extra = Array.from({ length: 12 }, (_, index) => ({
        first_name: `Extra${index}`,
        email: `extra${index}@example.test`,
        message: "Relleno de paginación.",
        contact_type: "catalogue" as const,
      }))
      await contactsService().createJovyContactRequests(extra)

      const firstPage = await listOk({ limit: 10, offset: 0 })
      const secondPage = await listOk({ limit: 10, offset: 10 })

      expect(firstPage.contacts).toHaveLength(10)
      expect(secondPage.contacts).toHaveLength(5)
      expect(firstPage.count).toBe(15)
      expect(secondPage.count).toBe(15)

      const ids = [...firstPage.contacts, ...secondPage.contacts].map((contact) => contact.id)
      expect(new Set(ids).size).toBe(15)
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

    it("busca por nombre, email, tipo y trata los comodines de LIKE como texto", async () => {
      const byEmail = await listOk({ q: "CATALOGO@EXAMPLE" })
      expect(byEmail.contacts.map((contact) => contact.email)).toEqual(["bruno.catalogo@example.test"])

      const byType = await listOk({ q: "customer" })
      expect(byType.contacts.map((contact) => contact.email)).toEqual(["carla.servicio@example.test"])

      const literalWildcard = await listOk({ q: "%" })
      expect(literalWildcard.count).toBe(0)
    })

    it("busca por teléfono con separadores, ciudad y código postal", async () => {
      const byPhone = await listOk({ q: "33 3333" })
      expect(byPhone.contacts.map((contact) => contact.email)).toEqual(["bruno.catalogo@example.test"])

      const byDigits = await listOk({ q: "4155556666" })
      expect(byDigits.contacts.map((contact) => contact.email)).toEqual(["carla.servicio@example.test"])

      const byCity = await listOk({ q: "guadalajara" })
      expect(byCity.contacts.map((contact) => contact.email)).toEqual(["bruno.catalogo@example.test"])

      const byPostalCode = await listOk({ q: "01000" })
      expect(byPostalCode.contacts.map((contact) => contact.email)).toEqual(["ana.nacional@example.test"])

      const byCountry = await listOk({ q: "estados unidos" })
      expect(byCountry.contacts.map((contact) => contact.email)).toEqual(["carla.servicio@example.test"])
    })

    it("filtra por rango de fechas ISO y rechaza fechas inválidas", async () => {
      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      expect((await listOk({ date_from: yesterday })).count).toBe(3)
      expect((await listOk({ date_from: yesterday, date_to: today })).count).toBe(3)

      const past = await listOk({ date_to: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) })
      expect(past.count).toBe(0)

      for (const query of [
        { date_from: "2026-02-31" },
        { date_to: "ayer" },
        { date_from: "2026-02-01", date_to: "2026-01-01" },
      ] as Array<Record<string, string>>) {
        const response = await listContacts(query)
        expect(response.status).toBe(400)
      }
    })

    it("rechaza filtros fuera del contrato", async () => {
      const tooLarge = await listContacts({ limit: 25 })
      expect(tooLarge.status).toBe(400)

      const unknownStatus = await listContacts({ status: "archived" })
      expect(unknownStatus.status).toBe(400)

      const unknownType = await listContacts({ contact_type: "ana.nacional@example.test" })
      expect(unknownType.status).toBe(400)
      expect(JSON.stringify(unknownType.data)).not.toContain("ana.nacional@example.test")

      const unknownField = await listContacts({ email: "ana.nacional@example.test" })
      expect(unknownField.status).toBe(400)
    })

    it("devuelve conteos por bandeja, con papelera y totales globales", async () => {
      const removed = await contactsService().createJovyContactRequests({
        first_name: "Diego",
        email: "diego.internacional@example.test",
        message: "Distribución internacional.",
        contact_type: "international-sales",
        status: "pending",
      })
      await api.delete(`/admin/jovy/contacts/${removed.id}`, {
        headers: adminHeaders(adminToken),
        validateStatus: () => true,
      })

      const response = await getCounts()

      expect(response.status).toBe(200)
      expect(response.data.counts).toEqual({
        "national-sales": { pending: 0, handled: 1, deleted: 0, total: 1 },
        "international-sales": { pending: 0, handled: 0, deleted: 1, total: 1 },
        "customer-service": { pending: 1, handled: 0, deleted: 0, total: 1 },
        catalogue: { pending: 1, handled: 0, deleted: 0, total: 1 },
      })
      expect(response.data.totals).toEqual({ pending: 2, handled: 1, deleted: 1, total: 4 })
      // The payload is counters only: no identifiers and no personal data.
      expect(Object.keys(response.data)).toEqual(["counts", "totals"])
      expect(JSON.stringify(response.data)).not.toContain("@")
    })

    it("cada bandeja filtra su tipo y excluye los borrados lógicos del conteo", async () => {
      const extra = await contactsService().createJovyContactRequests({
        first_name: "Elena",
        email: "elena.internacional@example.test",
        message: "Consulta de exportación.",
        contact_type: "international-sales",
        status: "pending",
      })

      const inboxes: Array<[string, string]> = [
        ["national-sales", "ana.nacional@example.test"],
        ["international-sales", "elena.internacional@example.test"],
        ["customer-service", "carla.servicio@example.test"],
        ["catalogue", "bruno.catalogo@example.test"],
      ]
      for (const [contactType, email] of inboxes) {
        const body = await listOk({ contact_type: contactType })
        expect(body.count).toBe(1)
        expect(body.contacts).toHaveLength(1)
        expect(body.contacts[0].email).toBe(email)
        expect(body.contacts[0].contact_type).toBe(contactType)
      }

      const removed = await api.delete(`/admin/jovy/contacts/${extra.id}`, {
        headers: adminHeaders(adminToken),
        validateStatus: () => true,
      })
      expect(removed.status).toBe(204)

      const counts = await getCounts()
      expect(counts.data.counts["international-sales"]).toEqual({ pending: 0, handled: 0, deleted: 1, total: 1 })
      expect((await listOk({ contact_type: "international-sales" })).count).toBe(0)
    })

    it("la papelera lista borrados y la restauración es idempotente", async () => {
      const created = await contactsService().createJovyContactRequests({
        first_name: "Frida",
        email: "frida.papelera@example.test",
        message: "Solicitud que se enviará a la papelera.",
        contact_type: "international-sales",
        status: "pending",
      })

      await api.delete(`/admin/jovy/contacts/${created.id}`, {
        headers: adminHeaders(adminToken),
        validateStatus: () => true,
      })

      const trash = await listOk({ status: "deleted" })
      expect(trash.count).toBe(1)
      expect(trash.contacts[0]).toMatchObject({ id: created.id, deleted_at: expect.any(String) })

      // La bandeja normal ya no lo muestra.
      expect((await listOk({ contact_type: "international-sales" })).count).toBe(0)

      const restored = await api.post(
        `/admin/jovy/contacts/${created.id}/restore`,
        {},
        {
          headers: adminHeaders(adminToken),
          validateStatus: () => true,
        },
      )
      expect(restored.status).toBe(200)
      expect(restored.data.contact).toMatchObject({ id: created.id })
      expect(restored.data.contact.deleted_at).toBeNull()

      // Segunda restauración: 200, sin duplicar ni fallar.
      const again = await api.post(
        `/admin/jovy/contacts/${created.id}/restore`,
        {},
        {
          headers: adminHeaders(adminToken),
          validateStatus: () => true,
        },
      )
      expect(again.status).toBe(200)

      expect((await listOk({ status: "deleted" })).count).toBe(0)
      expect((await listOk({ contact_type: "international-sales" })).count).toBe(1)

      const missing = await api.post(
        "/admin/jovy/contacts/req_inexistente/restore",
        {},
        {
          headers: adminHeaders(adminToken),
          validateStatus: () => true,
        },
      )
      expect(missing.status).toBe(404)
    })

    it("edita los datos del solicitante y audita sólo los nombres de los campos", async () => {
      const [contact] = await listOk({ contact_type: "catalogue" }).then((body) => body.contacts)

      const updated = await api.put(
        `/admin/jovy/contacts/${contact.id}`,
        {
          first_name: "Bruno Editado",
          last_name: "Catálogo Editado",
          email: "BRUNO.EDITADO@example.test",
          phone: "+52 33 0000 1111",
          city: "Monterrey",
          country: "México",
          postal_code: "64000",
          status: "handled",
          admin_notes: "Llamar por la tarde.",
        },
        { headers: adminHeaders(adminToken), validateStatus: () => true },
      )

      expect(updated.status).toBe(200)
      expect(updated.data.contact).toMatchObject({
        first_name: "Bruno Editado",
        last_name: "Catálogo Editado",
        email: "bruno.editado@example.test",
        city: "Monterrey",
        postal_code: "64000",
        status: "handled",
        admin_notes: "Llamar por la tarde.",
      })

      const audit = await api.get(`/admin/jovy/contacts/${contact.id}/audit`, {
        headers: adminHeaders(adminToken),
      })
      const updateLog = [...audit.data.audit_logs].reverse().find((log: { action: string }) => log.action === "update")
      expect(updateLog.metadata).toEqual({
        fields: ["city", "email", "first_name", "last_name", "phone", "postal_code"],
      })
      const serialized = JSON.stringify(audit.data)
      expect(serialized).not.toContain("BRUNO.EDITADO@example.test")
      expect(serialized).not.toContain("bruno.editado@example.test")
      expect(serialized).not.toContain("+52 33 0000 1111")
    })

    it("rechaza cambios de contact_type, id y campos fuera del contrato", async () => {
      const [contact] = await listOk({ contact_type: "catalogue" }).then((body) => body.contacts)

      for (const body of [
        { contact_type: "national-sales" },
        { id: "req_forzado" },
        { message: "mensaje alterado" },
        { deleted_at: null },
        { email: "no-es-un-email" },
      ]) {
        const response = await api.put(`/admin/jovy/contacts/${contact.id}`, body, {
          headers: adminHeaders(adminToken),
          validateStatus: () => true,
        })
        expect(response.status).toBe(400)
        expect(JSON.stringify(response.data)).not.toContain("no-es-un-email")
      }

      expect((await listOk({ contact_type: "catalogue" })).contacts[0].contact_type).toBe("catalogue")
    })

    it("exporta CSV de una sola bandeja con BOM, cabeceras y escaping", async () => {
      await contactsService().createJovyContactRequests({
        first_name: 'Eva, "Export"',
        last_name: "Prueba",
        email: "eva.export@example.test",
        phone: "+52 55 9999 0000",
        city: "Puebla",
        country: "México",
        postal_code: "72000",
        message: 'Mensaje con coma, "comillas" y salto\nde línea.',
        contact_type: "catalogue",
      })

      const response = await exportContacts({ contact_type: "catalogue" })
      expect(response.status).toBe(200)
      expect(response.headers["content-type"]).toContain("text/csv")
      expect(response.headers["cache-control"]).toBe("no-store")
      // Bruno + Eva: el mensaje multilínea no infla el conteo.
      expect(response.headers["x-export-count"]).toBe("2")

      expect([...Buffer.from(response.data).subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
      const csv = csvText(response)
      expect(csv.startsWith("ID,Tipo,Nombre,Apellido,Email,Teléfono,País,Ciudad,CP,Mensaje,Creado")).toBe(true)
      expect(csv).toContain('"Eva, ""Export"""')
      expect(csv).toContain('"Mensaje con coma, ""comillas"" y salto')
      // La fila de Eva ocupa dos líneas físicas: contar líneas daría 3, no 2.
      expect(csv.trimEnd().split(/\r?\n/).length - 1).toBe(3)
      // Sólo la bandeja solicitada.
      expect(csv).toContain("bruno.catalogo@example.test")
      expect(csv).toContain("eva.export@example.test")
      expect(csv).not.toContain("ana.nacional@example.test")
      expect(csv).not.toContain("carla.servicio@example.test")
    })

    it("la exportación exige bandeja, respeta la papelera y rechaza formatos desconocidos", async () => {
      for (const query of [
        {},
        { contact_type: "otro" },
        { contact_type: "catalogue", format: "pdf" },
      ] as Array<Record<string, string>>) {
        const response = await exportContacts(query)
        expect(response.status).toBe(400)
      }

      const created = await contactsService().createJovyContactRequests({
        first_name: "Gina",
        email: "gina.papelera@example.test",
        message: "Sólo debe verse con status=deleted.",
        contact_type: "catalogue",
      })
      await api.delete(`/admin/jovy/contacts/${created.id}`, {
        headers: adminHeaders(adminToken),
        validateStatus: () => true,
      })

      const live = await exportContacts({ contact_type: "catalogue" })
      expect(csvText(live)).not.toContain("gina.papelera@example.test")

      const trash = await exportContacts({ contact_type: "catalogue", status: "deleted" })
      expect(trash.status).toBe(200)
      expect(csvText(trash)).toContain("gina.papelera@example.test")
      expect(csvText(trash)).not.toContain("bruno.catalogo@example.test")
    })
  },
})
