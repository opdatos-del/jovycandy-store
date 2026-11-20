import { moduleIntegrationTestRunner, TestDatabaseUtils } from "@medusajs/test-utils"
import { permissionAllows } from "@jovy/lib/jovy/authz/permissions"
import { JOVY_AUTHZ_MODULE } from "@jovy/modules/jovy-authz"
import JovyAuthzAssignment from "@jovy/modules/jovy-authz/models/assignment"
import JovyAuthzPolicy from "@jovy/modules/jovy-authz/models/policy"
import JovyAuthzRole from "@jovy/modules/jovy-authz/models/role"
import JovyAuthzUserPolicy from "@jovy/modules/jovy-authz/models/user-policy"
import JovyAuthzAuditLog from "@jovy/modules/jovy-authz/models/audit-log"
import JovyAuthzModuleService from "@jovy/modules/jovy-authz/service"

jest.setTimeout(60_000)

const TEST_DATABASE = "medusa-jovy-authz-integration"

moduleIntegrationTestRunner<JovyAuthzModuleService>({
  moduleName: JOVY_AUTHZ_MODULE,
  moduleModels: [
    JovyAuthzRole,
    JovyAuthzPolicy,
    JovyAuthzAssignment,
    JovyAuthzUserPolicy,
    JovyAuthzAuditLog,
  ],
  resolve: "./src/modules/jovy-authz",
  dbName: TEST_DATABASE,
  testSuite: ({ service }) => {
    beforeAll(async () => {
      await TestDatabaseUtils.dbTestUtilFactory().create(TEST_DATABASE)
    })

    afterAll(async () => {
      await TestDatabaseUtils.dbTestUtilFactory().shutdown(TEST_DATABASE)
    })

    beforeEach(async () => {
      await service.ensureSystemRoles()
    })

    it("siembra los roles del sistema una sola vez", async () => {
      await service.ensureSystemRoles()
      const first = await service.listRolesWithPolicies()
      await service.ensureSystemRoles()
      const second = await service.listRolesWithPolicies()
      expect(second).toHaveLength(first.length)
      const superadmin = second.find((role) => role.code === "superadmin")
      expect(superadmin?.policies).toEqual([{ resource: "*", operation: "*" }])
      expect(second.some((role) => role.code === "cms_viewer")).toBe(true)
    })

    it("une roles y aplica deny individual", async () => {
      const national = await service.createCustomRole({
        code: "test_national",
        name: "Prueba nacional",
        policies: [
          { resource: "jovy_contacts_national", operation: "read" },
          { resource: "jovy_contacts_national", operation: "export" },
        ],
      })
      const international = await service.createCustomRole({
        code: "test_international",
        name: "Prueba internacional",
        policies: [{ resource: "jovy_contacts_international", operation: "read" }],
      })

      await service.replaceUserAccess("user_multi", [national.id, international.id], [])
      const effective = await service.resolveEffectivePermissions("user_multi")
      expect(effective.roles.sort()).toEqual(["test_international", "test_national"])
      expect(
        permissionAllows(
          effective.allow,
          effective.deny,
          "jovy_contacts_national",
          "read",
        ),
      ).toBe(true)
      expect(
        permissionAllows(
          effective.allow,
          effective.deny,
          "jovy_contacts_international",
          "read",
        ),
      ).toBe(true)
      expect(
        permissionAllows(effective.allow, effective.deny, "jovy_contacts_catalogue", "read"),
      ).toBe(false)

      await service.replaceUserAccess(
        "user_multi",
        [national.id, international.id],
        [{ resource: "jovy_contacts_national", operation: "export", effect: "deny" }],
      )
      const denied = await service.resolveEffectivePermissions("user_multi")
      expect(
        permissionAllows(
          denied.allow,
          denied.deny,
          "jovy_contacts_national",
          "export",
        ),
      ).toBe(false)
      expect(
        permissionAllows(denied.allow, denied.deny, "jovy_contacts_national", "read"),
      ).toBe(true)
    })

    it("revoca accesos al reasignar roles", async () => {
      await service.replaceUserAccess("user_revoke", [], [])
      const access = await service.getUserAccess("user_revoke")
      expect(access.role_ids).toEqual([])
      expect(access.policies).toEqual([])
    })

    it("no elimina roles con usuarios asignados ni roles del sistema", async () => {
      const role = await service.createCustomRole({
        code: "test_assigned",
        name: "Prueba asignada",
        policies: [{ resource: "jovy_dashboard", operation: "read" }],
      })
      await service.replaceUserAccess("user_assigned", [role.id], [])
      await expect(service.deleteCustomRole(role.id)).rejects.toThrow()
      const [system] = await service.listJovyAuthzRoles({ code: "superadmin" })
      await expect(service.deleteCustomRole(system.id)).rejects.toThrow()
    })

    it("rechaza políticas fuera del catálogo", async () => {
      const [role] = await service.listJovyAuthzRoles({ code: "cms_viewer" })
      await expect(
        service.replaceRolePolicies(role.id, [{ resource: "jovy_unknown", operation: "read" }]),
      ).rejects.toThrow()
      await expect(
        service.replaceRolePolicies(role.id, [{ resource: "jovy_dashboard", operation: "delete" }]),
      ).rejects.toThrow()
    })

    it("registra auditoría de los cambios", async () => {
      await service.createCustomRole({
        code: "test_audit",
        name: "Prueba auditoría",
        policies: [{ resource: "jovy_dashboard", operation: "read" }],
      }, "actor_audit")
      const logs = await service.listJovyAuthzAuditLogs({}, { order: { created_at: "DESC" } })
      expect(logs.some((log) => log.action === "role_create" && log.actor_id === "actor_audit")).toBe(true)
      expect(JSON.stringify(logs)).not.toContain("password")
    })

    it("asigna el bootstrap solo al correo configurado", async () => {
      const previous = process.env.JOVY_AUTHZ_BOOTSTRAP_EMAILS
      process.env.JOVY_AUTHZ_BOOTSTRAP_EMAILS = "bootstrap@example.test"
      try {
        expect(await service.ensureBootstrapAssignment("user_bootstrap", "otro@example.test")).toBe(false)
        expect(await service.ensureBootstrapAssignment("user_bootstrap", "bootstrap@example.test")).toBe(true)
        const effective = await service.resolveEffectivePermissions("user_bootstrap")
        expect(effective.roles).toContain("superadmin")
      } finally {
        process.env.JOVY_AUTHZ_BOOTSTRAP_EMAILS = previous
      }
    })
  },
})
