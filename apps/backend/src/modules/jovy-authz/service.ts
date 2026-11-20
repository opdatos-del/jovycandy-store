import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import {
  AUTHZ_RESOURCES,
  SYSTEM_ROLE_TEMPLATES,
  type AuthzOperation,
} from "@jovy/lib/jovy/authz/catalog"
import { invalidateAuthzCache } from "@jovy/lib/jovy/authz/cache"
import JovyAuthzAssignment from "./models/assignment"
import JovyAuthzAuditLog from "./models/audit-log"
import JovyAuthzPolicy from "./models/policy"
import JovyAuthzRole from "./models/role"
import JovyAuthzUserPolicy from "./models/user-policy"

export type PolicyInput = {
  resource: string
  operation: string
  effect?: "allow" | "deny"
}

export type RoleWithPolicies = {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
  policies: Array<{ resource: string; operation: string }>
}

const RESOURCE_MAP = new Map(AUTHZ_RESOURCES.map((resource) => [resource.key, resource]))

function assertValidPolicy(policy: PolicyInput, allowWildcard: boolean) {
  if (allowWildcard && policy.resource === "*" && policy.operation === "*") return
  const resource = RESOURCE_MAP.get(policy.resource)
  if (!resource) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Recurso desconocido: ${policy.resource}`)
  }
  if (!(resource.operations as readonly string[]).includes(policy.operation)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Operación no válida para ${policy.resource}: ${policy.operation}`,
    )
  }
}

export default class JovyAuthzModuleService extends MedusaService({
  JovyAuthzRole,
  JovyAuthzPolicy,
  JovyAuthzAssignment,
  JovyAuthzUserPolicy,
  JovyAuthzAuditLog,
}) {
  private async recordAudit(input: {
    actorId: string | null
    action:
      | "role_create"
      | "role_update"
      | "role_delete"
      | "policies_replace"
      | "user_access_replace"
      | "bootstrap"
    targetType: string
    targetId: string
    metadata?: Record<string, unknown>
  }) {
    await this.createJovyAuthzAuditLogs({
      actor_id: input.actorId,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId,
      metadata: input.metadata ?? null,
    })
  }

  /** Crea los roles semilla ausentes. Nunca sobrescribe políticas ajustadas. */
  async ensureSystemRoles(): Promise<void> {
    for (const template of SYSTEM_ROLE_TEMPLATES) {
      const [existing] = await this.listJovyAuthzRoles({ code: template.code })
      if (existing) continue
      let role
      try {
        role = await this.createJovyAuthzRoles({
          code: template.code,
          name: template.name,
          description: template.description,
          is_system: template.is_system,
        })
      } catch (error) {
        // Otro proceso pudo crear el rol entre la consulta y el insert.
        const [concurrent] = await this.listJovyAuthzRoles({ code: template.code })
        if (!concurrent) throw error
        continue
      }
      await this.createJovyAuthzPolicies(
        template.policies.map((policy) => ({
          role_id: role.id,
          resource: policy.resource,
          operation: policy.operation as AuthzOperation,
        })),
      )
    }
    invalidateAuthzCache()
  }

  async listRolesWithPolicies(): Promise<RoleWithPolicies[]> {
    await this.ensureSystemRoles()
    const roles = await this.listJovyAuthzRoles({}, { order: { is_system: "DESC", name: "ASC" } })
    const policies = await this.listJovyAuthzPolicies({})
    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? null,
      is_system: role.is_system,
      policies: policies
        .filter((policy) => policy.role_id === role.id)
        .map((policy) => ({ resource: policy.resource, operation: policy.operation })),
    }))
  }

  async createCustomRole(input: {
    code: string
    name: string
    description?: string | null
    policies: PolicyInput[]
  }, actorId: string | null = null) {
    const code = input.code.trim()
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(code)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "El código del rol debe usar minúsculas, números y guiones bajos.",
      )
    }
    const [existing] = await this.listJovyAuthzRoles({ code })
    if (existing) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `El rol ${code} ya existe.`)
    }
    const policies = input.policies.map((policy) => ({ ...policy }))
    policies.forEach((policy) => assertValidPolicy(policy, false))

    const role = await this.createJovyAuthzRoles({
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      is_system: false,
    })
    if (policies.length) {
      await this.createJovyAuthzPolicies(
        policies.map((policy) => ({
          role_id: role.id,
          resource: policy.resource,
          operation: policy.operation,
        })),
      )
    }
    await this.recordAudit({
      actorId,
      action: "role_create",
      targetType: "role",
      targetId: role.id,
      metadata: { code, policies: policies.map((policy) => `${policy.resource}:${policy.operation}`) },
    })
    invalidateAuthzCache()
    return role
  }

  async updateRoleMeta(id: string, input: { name?: string; description?: string | null }, actorId: string | null = null) {
    const role = await this.retrieveJovyAuthzRole(id)
    await this.updateJovyAuthzRoles({
      id: role.id,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    })
    await this.recordAudit({
      actorId,
      action: "role_update",
      targetType: "role",
      targetId: role.id,
      metadata: { code: role.code, fields: Object.keys(input) },
    })
    invalidateAuthzCache()
  }

  async replaceRolePolicies(roleId: string, policies: PolicyInput[], actorId: string | null = null) {
    const role = await this.retrieveJovyAuthzRole(roleId)
    const allowWildcard = role.code === "superadmin"
    const unique = new Map<string, PolicyInput>()
    for (const policy of policies) {
      assertValidPolicy(policy, allowWildcard)
      unique.set(`${policy.resource}:${policy.operation}`, policy)
    }

    const existing = await this.listJovyAuthzPolicies({ role_id: role.id })
    if (existing.length) {
      await this.deleteJovyAuthzPolicies(existing.map((policy) => policy.id))
    }
    if (unique.size) {
      await this.createJovyAuthzPolicies(
        [...unique.values()].map((policy) => ({
          role_id: role.id,
          resource: policy.resource,
          operation: policy.operation,
        })),
      )
    }
    await this.recordAudit({
      actorId,
      action: "policies_replace",
      targetType: "role",
      targetId: role.id,
      metadata: {
        code: role.code,
        policies: [...unique.values()].map((policy) => `${policy.resource}:${policy.operation}`),
      },
    })
    invalidateAuthzCache()
  }

  async deleteCustomRole(id: string, actorId: string | null = null) {
    const role = await this.retrieveJovyAuthzRole(id)
    if (role.is_system) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Los roles del sistema no se eliminan; ajusta sus políticas.",
      )
    }
    const assignments = await this.listJovyAuthzAssignments({ role_id: role.id })
    if (assignments.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "El rol tiene usuarios asignados; reasígnalos antes de eliminarlo.",
      )
    }
    const policies = await this.listJovyAuthzPolicies({ role_id: role.id })
    if (policies.length) await this.deleteJovyAuthzPolicies(policies.map((policy) => policy.id))
    await this.deleteJovyAuthzRoles(role.id)
    await this.recordAudit({
      actorId,
      action: "role_delete",
      targetType: "role",
      targetId: role.id,
      metadata: { code: role.code },
    })
    invalidateAuthzCache()
  }

  async getUserAccess(userId: string) {
    const assignments = await this.listJovyAuthzAssignments({ user_id: userId })
    const direct = await this.listJovyAuthzUserPolicies({ user_id: userId })
    return {
      role_ids: assignments.map((assignment) => assignment.role_id),
      policies: direct.map((policy) => ({
        resource: policy.resource,
        operation: policy.operation,
        effect: policy.effect as "allow" | "deny",
      })),
    }
  }

  async replaceUserAccess(
    userId: string,
    roleIds: string[],
    policies: Array<{ resource: string; operation: string; effect: "allow" | "deny" }>,
    actorId: string | null = null,
  ) {
    const uniqueRoleIds = [...new Set(roleIds)]
    if (uniqueRoleIds.length) {
      const roles = await this.listJovyAuthzRoles({ id: uniqueRoleIds })
      if (roles.length !== uniqueRoleIds.length) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Uno de los roles no existe.")
      }
    }
    for (const policy of policies) assertValidPolicy(policy, false)

    const currentAssignments = await this.listJovyAuthzAssignments({ user_id: userId })
    if (currentAssignments.length) {
      await this.deleteJovyAuthzAssignments(currentAssignments.map((item) => item.id))
    }
    if (uniqueRoleIds.length) {
      await this.createJovyAuthzAssignments(
        uniqueRoleIds.map((roleId) => ({ user_id: userId, role_id: roleId })),
      )
    }

    const currentPolicies = await this.listJovyAuthzUserPolicies({ user_id: userId })
    if (currentPolicies.length) {
      await this.deleteJovyAuthzUserPolicies(currentPolicies.map((item) => item.id))
    }
    if (policies.length) {
      await this.createJovyAuthzUserPolicies(
        policies.map((policy) => ({
          user_id: userId,
          resource: policy.resource,
          operation: policy.operation,
          effect: policy.effect,
        })),
      )
    }
    await this.recordAudit({
      actorId,
      action: "user_access_replace",
      targetType: "user",
      targetId: userId,
      metadata: {
        role_ids: uniqueRoleIds,
        policies: policies.map((policy) => `${policy.resource}:${policy.operation}:${policy.effect}`),
      },
    })
    invalidateAuthzCache(userId)
  }

  /**
   * Resuelve la unión de roles más las excepciones individuales. Las políticas
   * `deny` se aplican al final en `permissionAllows`; aquí solo se agrupan.
   */
  async resolveEffectivePermissions(userId: string) {
    const assignments = await this.listJovyAuthzAssignments({ user_id: userId })
    const roleIds = [...new Set(assignments.map((assignment) => assignment.role_id))]
    const roles = roleIds.length ? await this.listJovyAuthzRoles({ id: roleIds }) : []
    const rolePolicies = roleIds.length
      ? await this.listJovyAuthzPolicies({ role_id: roleIds })
      : []
    const direct = await this.listJovyAuthzUserPolicies({ user_id: userId })

    const allow = new Set<string>()
    const deny = new Set<string>()
    for (const policy of rolePolicies) allow.add(`${policy.resource}:${policy.operation}`)
    for (const policy of direct) {
      const key = `${policy.resource}:${policy.operation}`
      if (policy.effect === "deny") deny.add(key)
      else allow.add(key)
    }

    return {
      roles: roles.map((role) => role.code),
      allow,
      deny,
    }
  }

  async ensureBootstrapAssignment(userId: string, email: string | null | undefined) {
    if (!email) return false
    const configured = (process.env.JOVY_AUTHZ_BOOTSTRAP_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
    // El runner de integración crea este usuario en cada suite; solo existe
    // cuando TEST_TYPE/NODE_ENV identifica un test, nunca en desarrollo o
    // producción.
    if (
      process.env.NODE_ENV === "test" ||
      (process.env.TEST_TYPE ?? "").startsWith("integration")
    ) {
      configured.push("admin.integration@jovy.test")
    }
    if (!configured.includes(email.toLowerCase())) return false

    const [role] = await this.listJovyAuthzRoles({ code: "superadmin" })
    if (!role) return false
    const [assignment] = await this.listJovyAuthzAssignments({
      user_id: userId,
      role_id: role.id,
    })
    if (!assignment) {
      await this.createJovyAuthzAssignments({ user_id: userId, role_id: role.id })
      await this.recordAudit({
        actorId: null,
        action: "bootstrap",
        targetType: "user",
        targetId: userId,
        metadata: { role: "superadmin" },
      })
      invalidateAuthzCache(userId)
    }
    return true
  }
}
