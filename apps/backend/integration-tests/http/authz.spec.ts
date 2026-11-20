import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ApiKeyType, Modules } from "@medusajs/framework/utils"
import { JOVY_CONTACTS_MODULE } from "@jovy/modules/jovy-contacts"
import type JovyContactsModuleService from "@jovy/modules/jovy-contacts/service"
import {
  adminHeaders,
  createAdminUserSession,
  createUserSession,
  type TestApi,
} from "./utils"

jest.setTimeout(180_000)

type Session = { token: string; user: { id: string; email: string } }

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-authz",
  testSuite: ({ api, getContainer }) => {
    let admin: Session
    let noRole: Session
    let viewer: Session
    let national: Session
    let nationalNoExport: Session
    let union: Session
    let productViewer: Session
    let accessReader: Session
    let accessManager: Session
    let contentEditor: Session
    let nationalContactId: string
    let internationalContactId: string
    let contentPageId: string

    const headers = (session: Session) => adminHeaders(session.token)

    async function createRole(
      code: string,
      policies: Array<{ resource: string; operation: string }>,
    ) {
      const response = await api.post(
        "/admin/jovy/authz/roles",
        { code, name: `Rol ${code}`, policies },
        { headers: headers(admin) },
      )
      expect(response.status).toBe(201)
      return response.data.role.id as string
    }

    async function assign(
      target: Session,
      roleIds: string[],
      policies: Array<{ resource: string; operation: string; effect: "allow" | "deny" }> = [],
    ) {
      const response = await api.put(
        `/admin/jovy/authz/users/${target.user.id}`,
        { role_ids: roleIds, policies },
        { headers: headers(admin) },
      )
      expect(response.status).toBe(200)
    }

    async function roleId(code: string) {
      const response = await api.get("/admin/jovy/authz/roles", { headers: headers(admin) })
      const role = response.data.roles.find((item: { code: string }) => item.code === code)
      expect(role).toBeDefined()
      return role.id as string
    }

    beforeAll(async () => {
      api.defaults.validateStatus = () => true
      admin = await createAdminUserSession(getContainer(), api as TestApi)
      const contacts = getContainer().resolve(JOVY_CONTACTS_MODULE) as JovyContactsModuleService

      noRole = await createUserSession(getContainer(), api as TestApi, "authz.norole@jovy.test", "Authz-Test-1234")
      viewer = await createUserSession(getContainer(), api as TestApi, "authz.viewer@jovy.test", "Authz-Test-1234")
      national = await createUserSession(getContainer(), api as TestApi, "authz.national@jovy.test", "Authz-Test-1234")
      nationalNoExport = await createUserSession(getContainer(), api as TestApi, "authz.export@jovy.test", "Authz-Test-1234")
      union = await createUserSession(getContainer(), api as TestApi, "authz.union@jovy.test", "Authz-Test-1234")
      productViewer = await createUserSession(getContainer(), api as TestApi, "authz.product@jovy.test", "Authz-Test-1234")
      accessReader = await createUserSession(getContainer(), api as TestApi, "authz.access@jovy.test", "Authz-Test-1234")
      accessManager = await createUserSession(getContainer(), api as TestApi, "authz.manager@jovy.test", "Authz-Test-1234")
      contentEditor = await createUserSession(getContainer(), api as TestApi, "authz.content@jovy.test", "Authz-Test-1234")

      const viewerRole = await createRole("it_dashboard_viewer", [
        { resource: "jovy_dashboard", operation: "read" },
      ])
      const noExportRole = await createRole("it_national_no_export", [
        { resource: "jovy_contacts_national", operation: "read" },
        { resource: "jovy_contacts_national", operation: "update" },
      ])
      const productRole = await createRole("it_product_reader", [
        { resource: "medusa_products", operation: "read" },
        { resource: "medusa_sales_channels", operation: "read" },
      ])
      const accessRole = await createRole("it_access_reader", [
        { resource: "jovy_access", operation: "read" },
      ])
      const managerRole = await createRole("it_access_manager", [
        { resource: "jovy_access", operation: "read" },
        { resource: "jovy_access", operation: "manage_settings" },
      ])
      const contentRole = await createRole("it_content_editor", [
        { resource: "jovy_content", operation: "read" },
        { resource: "jovy_content", operation: "update" },
      ])

      await assign(viewer, [viewerRole])
      await assign(national, [await roleId("sales_national_sales")])
      await assign(nationalNoExport, [noExportRole])
      await assign(union, [
        await roleId("sales_national_sales"),
        await roleId("sales_international_sales"),
      ])
      await assign(productViewer, [productRole])
      await assign(accessReader, [accessRole])
      await assign(accessManager, [managerRole])
      await assign(contentEditor, [contentRole])

      nationalContactId = (
        await contacts.createJovyContactRequests({
          first_name: "Nacional",
          last_name: "Authz",
          email: "contacto.nacional.authz@example.test",
          message: "Solicitud nacional de prueba de autorización.",
          contact_type: "national-sales",
          status: "pending",
        })
      ).id
      internationalContactId = (
        await contacts.createJovyContactRequests({
          first_name: "Internacional",
          last_name: "Authz",
          email: "contacto.internacional.authz@example.test",
          message: "Solicitud internacional de prueba de autorización.",
          contact_type: "international-sales",
          status: "pending",
        })
      ).id

      const page = await api.post(
        "/admin/jovy/content/pages",
        {
          slug: `authz-page-${Date.now()}`,
          status: "draft",
          translations: {
            es: { title: "Página de autorización" },
            en: { title: "Authorization page" },
          },
        },
        { headers: headers(admin) },
      )
      expect(page.status).toBe(201)
      contentPageId = page.data.page.id
    })

    it("devuelve 401 sin sesión", async () => {
      const response = await api.get("/admin/jovy/dashboard")
      expect(response.status).toBe(401)
    })

    it("deniega por defecto a un usuario sin roles", async () => {
      const dashboard = await api.get("/admin/jovy/dashboard", { headers: headers(noRole) })
      expect(dashboard.status).toBe(403)
      const me = await api.get("/admin/jovy/authz/me", { headers: headers(noRole) })
      expect(me.status).toBe(200)
      expect(me.data.permissions).toEqual([])
      expect(me.data.wildcard).toBe(false)
    })

    it("permite lectura y deniega escritura y administración", async () => {
      const dashboard = await api.get("/admin/jovy/dashboard", { headers: headers(viewer) })
      expect(dashboard.status).toBe(200)
      const contacts = await api.get("/admin/jovy/contacts", { headers: headers(viewer) })
      expect(contacts.status).toBe(403)
      const roles = await api.get("/admin/jovy/authz/roles", { headers: headers(viewer) })
      expect(roles.status).toBe(403)
    })

    it("aísla la bandeja nacional de la internacional", async () => {
      const own = await api.get("/admin/jovy/contacts?contact_type=national-sales", {
        headers: headers(national),
      })
      expect(own.status).toBe(200)
      expect(own.data.contacts.every((contact: { contact_type: string }) => contact.contact_type === "national-sales")).toBe(true)

      const cross = await api.get("/admin/jovy/contacts?contact_type=international-sales", {
        headers: headers(national),
      })
      expect(cross.status).toBe(403)

      const consolidated = await api.get("/admin/jovy/contacts", { headers: headers(national) })
      expect(consolidated.status).toBe(403)

      const counts = await api.get("/admin/jovy/contacts/counts", { headers: headers(national) })
      expect(counts.status).toBe(403)

      const crossById = await api.get(`/admin/jovy/contacts/${internationalContactId}`, {
        headers: headers(national),
      })
      expect(crossById.status).toBe(404)

      const crossUpdate = await api.put(
        `/admin/jovy/contacts/${internationalContactId}`,
        { status: "handled" },
        { headers: headers(national) },
      )
      expect(crossUpdate.status).toBe(404)

      const crossAudit = await api.get(`/admin/jovy/contacts/${internationalContactId}/audit`, {
        headers: headers(national),
      })
      expect(crossAudit.status).toBe(404)

      const ownUpdate = await api.put(
        `/admin/jovy/contacts/${nationalContactId}`,
        { status: "handled" },
        { headers: headers(national) },
      )
      expect(ownUpdate.status).toBe(200)
    })

    it("separa exportación de lectura", async () => {
      const read = await api.get("/admin/jovy/contacts?contact_type=national-sales", {
        headers: headers(nationalNoExport),
      })
      expect(read.status).toBe(200)
      const exportOwn = await api.get(
        "/admin/jovy/contacts/export?contact_type=national-sales&format=csv",
        { headers: headers(nationalNoExport) },
      )
      expect(exportOwn.status).toBe(403)
    })

    it("une roles y exige todas las bandejas para el consolidado", async () => {
      for (const contactType of ["national-sales", "international-sales"]) {
        const response = await api.get(`/admin/jovy/contacts?contact_type=${contactType}`, {
          headers: headers(union),
        })
        expect(response.status).toBe(200)
      }
      const consolidated = await api.get("/admin/jovy/contacts", { headers: headers(union) })
      expect(consolidated.status).toBe(403)
      const counts = await api.get("/admin/jovy/contacts/counts", { headers: headers(union) })
      expect(counts.status).toBe(403)

      const twoSheets = await api.get(
        "/admin/jovy/contacts/export-all?contact_types=national-sales,international-sales",
        { headers: headers(union) },
      )
      expect(twoSheets.status).toBe(200)
      const allSheets = await api.get("/admin/jovy/contacts/export-all", {
        headers: headers(union),
      })
      expect(allSheets.status).toBe(403)
    })

    it("protege las superficies comerciales nativas por permiso", async () => {
      const products = await api.get("/admin/products", { headers: headers(productViewer) })
      expect(products.status).toBe(200)
      const write = await api.post("/admin/products", {}, { headers: headers(productViewer) })
      expect(write.status).toBe(403)
      const users = await api.get("/admin/users", { headers: headers(productViewer) })
      expect(users.status).toBe(403)
      const me = await api.get("/admin/users/me", { headers: headers(productViewer) })
      expect(me.status).toBe(200)
      const unknown = await api.get("/admin/authz-unknown", { headers: headers(productViewer) })
      expect(unknown.status).toBe(403)
    })

    it("impide delegar accesos sin el permiso de administración", async () => {
      const roles = await api.get("/admin/jovy/authz/roles", { headers: headers(accessReader) })
      expect(roles.status).toBe(200)
      const users = await api.get("/admin/jovy/authz/users", { headers: headers(accessReader) })
      expect(users.status).toBe(200)
      const targetRole = roles.data.roles.find((role: { code: string }) => role.code === "cms_viewer")
      const write = await api.put(
        `/admin/jovy/authz/roles/${targetRole.id}/policies`,
        { policies: [] },
        { headers: headers(accessReader) },
      )
      expect(write.status).toBe(403)
    })

    it("impide que un usuario modifique sus propios accesos", async () => {
      const response = await api.put(
        `/admin/jovy/authz/users/${admin.user.id}`,
        { role_ids: [], policies: [] },
        { headers: headers(admin) },
      )
      expect(response.status).toBe(403)
    })

    it("impide delegar permisos superiores o editar el propio rol", async () => {
      const escalation = await api.post(
        "/admin/jovy/authz/roles",
        {
          code: "it_escalated_role",
          name: "Intento de escalada",
          policies: [{ resource: "jovy_contacts_national", operation: "read" }],
        },
        { headers: headers(accessManager) },
      )
      expect(escalation.status).toBe(403)

      const managerRoles = await api.get("/admin/jovy/authz/roles", {
        headers: headers(accessManager),
      })
      const ownRole = managerRoles.data.roles.find(
        (role: { code: string }) => role.code === "it_access_manager",
      )
      const selfEdit = await api.put(
        `/admin/jovy/authz/roles/${ownRole.id}/policies`,
        { policies: [{ resource: "jovy_access", operation: "read" }] },
        { headers: headers(accessManager) },
      )
      expect(selfEdit.status).toBe(403)

      const allRoles = await api.get("/admin/jovy/authz/roles", { headers: headers(admin) })
      const superadminRole = allRoles.data.roles.find(
        (role: { code: string }) => role.code === "superadmin",
      )
      const grantSuperadmin = await api.put(
        `/admin/jovy/authz/users/${contentEditor.user.id}`,
        { role_ids: [superadminRole.id], policies: [] },
        { headers: headers(accessManager) },
      )
      expect(grantSuperadmin.status).toBe(403)
    })

    it("filtra la navegación por permisos efectivos", async () => {
      const nationalNav = await api.get("/admin/jovy/authz/navigation", {
        headers: headers(national),
      })
      expect(nationalNav.status).toBe(200)
      expect(nationalNav.data.groups.map((group: { id: string }) => group.id)).toEqual(["jovy"])
      expect(nationalNav.data.groups[0].items.map((item: { label: string }) => item.label)).toEqual([
        "Ventas Nacionales",
      ])

      const productNav = await api.get("/admin/jovy/authz/navigation", {
        headers: headers(productViewer),
      })
      expect(productNav.status).toBe(200)
      expect(productNav.data.groups.map((group: { id: string }) => group.id)).toEqual(["medusa"])
    })

    it("registra auditoría de cambios de acceso", async () => {
      const response = await api.get("/admin/jovy/authz/audit", { headers: headers(admin) })
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data.audit_logs)).toBe(true)
      expect(response.data.audit_logs.length).toBeGreaterThan(0)
      expect(JSON.stringify(response.data.audit_logs)).not.toContain("password")
    })

    it("exige publish además de update", async () => {
      const denied = await api.put(
        `/admin/jovy/content/pages/${contentPageId}`,
        { status: "published" },
        { headers: headers(contentEditor) },
      )
      expect(denied.status).toBe(403)
      const draft = await api.put(
        `/admin/jovy/content/pages/${contentPageId}`,
        { status: "draft" },
        { headers: headers(contentEditor) },
      )
      expect(draft.status).toBe(200)
    })

    it("rechaza API keys secretas en el Admin", async () => {
      const apiKeyModule = getContainer().resolve(Modules.API_KEY)
      const key = await apiKeyModule.createApiKeys({
        title: "Authz machine key",
        type: ApiKeyType.SECRET,
        created_by: admin.user.id,
      })
      const response = await api.get("/admin/jovy/dashboard", {
        headers: { "x-medusa-access-token": key.token },
      })
      expect(response.status).toBe(401)
    })
  },
})
