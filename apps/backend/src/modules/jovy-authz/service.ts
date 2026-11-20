import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
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

export type BootstrapResult = "created" | "already"

const RESOURCE_MAP = new Map(AUTHZ_RESOURCES.map((resource) => [resource.key, resource]))
const SUPERADMIN_CODE = "superadmin"
const BOOTSTRAP_AUDIT_ACTION = "bootstrap"

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

/**
 * Servicio de autorización. Las escrituras siguen el patrón oficial de Medusa:
 * un método público `@InjectManager` delega en un método protegido
 * `@InjectTransactionManager`, de modo que rol, políticas y auditoría se
 * confirman o revierten juntos.
 */
export default class JovyAuthzModuleService extends MedusaService({
  JovyAuthzRole,
  JovyAuthzPolicy,
  JovyAuthzAssignment,
  JovyAuthzUserPolicy,
  JovyAuthzAuditLog,
}) {
  @InjectTransactionManager()
  private async recordAudit_(
    input: {
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
    },
    @MedusaContext() context: Context = {},
  ) {
    await this.createJovyAuthzAuditLogs(
      {
        actor_id: input.actorId,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId,
        metadata: input.metadata ?? null,
      },
      context,
    )
  }

  /**
   * Crea los roles semilla ausentes. Nunca sobrescribe políticas ajustadas.
   * Se invoca desde el bootstrap operativo y desde pruebas; no desde lecturas
   * GET ni desde la resolución de permisos.
   */
  @InjectManager()
  async ensureSystemRoles(@MedusaContext() context: Context = {}): Promise<void> {
    return await this.ensureSystemRoles_(context)
  }

  @InjectTransactionManager()
  protected async ensureSystemRoles_(@MedusaContext() context: Context = {}): Promise<void> {
    for (const template of SYSTEM_ROLE_TEMPLATES) {
      const [existing] = await this.listJovyAuthzRoles({ code: template.code }, {}, context)
      if (existing) continue
      let role
      try {
        role = await this.createJovyAuthzRoles(
          {
            code: template.code,
            name: template.name,
            description: template.description,
            is_system: template.is_system,
          },
          context,
        )
      } catch (error) {
        // Otro proceso pudo crear el rol entre la consulta y el insert.
        const [concurrent] = await this.listJovyAuthzRoles({ code: template.code }, {}, context)
        if (!concurrent) throw error
        continue
      }
      await this.createJovyAuthzPolicies(
        template.policies.map((policy) => ({
          role_id: role.id,
          resource: policy.resource,
          operation: policy.operation as AuthzOperation,
        })),
        context,
      )
    }
    invalidateAuthzCache()
  }

  /** Lectura pura: no siembra roles ni escribe en base de datos. */
  async listRolesWithPolicies(): Promise<RoleWithPolicies[]> {
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

  @InjectManager()
  async createCustomRole(
    input: {
      code: string
      name: string
      description?: string | null
      policies: PolicyInput[]
    },
    actorId: string | null = null,
    @MedusaContext() context: Context = {},
  ) {
    return await this.createCustomRole_(input, actorId, context)
  }

  @InjectTransactionManager()
  protected async createCustomRole_(
    input: {
      code: string
      name: string
      description?: string | null
      policies: PolicyInput[]
    },
    actorId: string | null,
    @MedusaContext() context: Context = {},
  ) {
    const code = input.code.trim()
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(code)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "El código del rol debe usar minúsculas, números y guiones bajos.",
      )
    }
    const [existing] = await this.listJovyAuthzRoles({ code }, {}, context)
    if (existing) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `El rol ${code} ya existe.`)
    }
    const policies = input.policies.map((policy) => ({ ...policy }))
    policies.forEach((policy) => assertValidPolicy(policy, false))

    const role = await this.createJovyAuthzRoles(
      {
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        is_system: false,
      },
      context,
    )
    if (policies.length) {
      await this.createJovyAuthzPolicies(
        policies.map((policy) => ({
          role_id: role.id,
          resource: policy.resource,
          operation: policy.operation,
        })),
        context,
      )
    }
    await this.recordAudit_(
      {
        actorId,
        action: "role_create",
        targetType: "role",
        targetId: role.id,
        metadata: { code, policies: policies.map((policy) => `${policy.resource}:${policy.operation}`) },
      },
      context,
    )
    invalidateAuthzCache()
    return role
  }

  @InjectManager()
  async updateRoleMeta(
    id: string,
    input: { name?: string; description?: string | null },
    actorId: string | null = null,
    @MedusaContext() context: Context = {},
  ) {
    return await this.updateRoleMeta_(id, input, actorId, context)
  }

  @InjectTransactionManager()
  protected async updateRoleMeta_(
    id: string,
    input: { name?: string; description?: string | null },
    actorId: string | null,
    @MedusaContext() context: Context = {},
  ) {
    const role = await this.retrieveJovyAuthzRole(id, {}, context)
    await this.updateJovyAuthzRoles(
      {
        id: role.id,
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
      },
      context,
    )
    await this.recordAudit_(
      {
        actorId,
        action: "role_update",
        targetType: "role",
        targetId: role.id,
        metadata: { code: role.code, fields: Object.keys(input) },
      },
      context,
    )
    invalidateAuthzCache()
  }

  @InjectManager()
  async replaceRolePolicies(
    roleId: string,
    policies: PolicyInput[],
    actorId: string | null = null,
    @MedusaContext() context: Context = {},
  ) {
    return await this.replaceRolePolicies_(roleId, policies, actorId, context)
  }

  @InjectTransactionManager()
  protected async replaceRolePolicies_(
    roleId: string,
    policies: PolicyInput[],
    actorId: string | null,
    @MedusaContext() context: Context = {},
  ) {
    const role = await this.retrieveJovyAuthzRole(roleId, {}, context)
    const allowWildcard = role.code === SUPERADMIN_CODE
    const unique = new Map<string, PolicyInput>()
    for (const policy of policies) {
      assertValidPolicy(policy, allowWildcard)
      unique.set(`${policy.resource}:${policy.operation}`, policy)
    }

    const existing = await this.listJovyAuthzPolicies({ role_id: role.id }, {}, context)
    if (existing.length) {
      await this.deleteJovyAuthzPolicies(existing.map((policy) => policy.id), context)
    }
    if (unique.size) {
      await this.createJovyAuthzPolicies(
        [...unique.values()].map((policy) => ({
          role_id: role.id,
          resource: policy.resource,
          operation: policy.operation,
        })),
        context,
      )
    }
    await this.recordAudit_(
      {
        actorId,
        action: "policies_replace",
        targetType: "role",
        targetId: role.id,
        metadata: {
          code: role.code,
          policies: [...unique.values()].map((policy) => `${policy.resource}:${policy.operation}`),
        },
      },
      context,
    )
    invalidateAuthzCache()
  }

  @InjectManager()
  async deleteCustomRole(
    id: string,
    actorId: string | null = null,
    @MedusaContext() context: Context = {},
  ) {
    return await this.deleteCustomRole_(id, actorId, context)
  }

  @InjectTransactionManager()
  protected async deleteCustomRole_(
    id: string,
    actorId: string | null,
    @MedusaContext() context: Context = {},
  ) {
    const role = await this.retrieveJovyAuthzRole(id, {}, context)
    if (role.is_system) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Los roles del sistema no se eliminan; ajusta sus políticas.",
      )
    }
    const assignments = await this.listJovyAuthzAssignments({ role_id: role.id }, {}, context)
    if (assignments.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "El rol tiene usuarios asignados; reasígnalos antes de eliminarlo.",
      )
    }
    const policies = await this.listJovyAuthzPolicies({ role_id: role.id }, {}, context)
    if (policies.length) {
      await this.deleteJovyAuthzPolicies(policies.map((policy) => policy.id), context)
    }
    await this.deleteJovyAuthzRoles(role.id, context)
    await this.recordAudit_(
      {
        actorId,
        action: "role_delete",
        targetType: "role",
        targetId: role.id,
        metadata: { code: role.code },
      },
      context,
    )
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

  /**
   * Impide dejar el sistema sin Superadministrador. Solo se aplica cuando el
   * usuario objetivo es el último con el rol; un cambio sobre cualquier otro
   * usuario no se bloquea.
   */
  @InjectTransactionManager()
  private async assertNotLastSuperadmin_(
    userId: string,
    nextRoleIds: string[],
    @MedusaContext() context: Context = {},
  ) {
    const [superadmin] = await this.listJovyAuthzRoles({ code: SUPERADMIN_CODE }, {}, context)
    if (!superadmin) return
    if (nextRoleIds.includes(superadmin.id)) return
    const assignments = await this.listJovyAuthzAssignments({ role_id: superadmin.id }, {}, context)
    const isHolder = assignments.some((assignment) => assignment.user_id === userId)
    if (isHolder && assignments.length === 1) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "No se puede retirar el último Superadministrador; asigna el rol a otro usuario primero.",
      )
    }
  }

  @InjectManager()
  async replaceUserAccess(
    userId: string,
    roleIds: string[],
    policies: Array<{ resource: string; operation: string; effect: "allow" | "deny" }>,
    actorId: string | null = null,
    @MedusaContext() context: Context = {},
  ) {
    return await this.replaceUserAccess_(userId, roleIds, policies, actorId, context)
  }

  @InjectTransactionManager()
  protected async replaceUserAccess_(
    userId: string,
    roleIds: string[],
    policies: Array<{ resource: string; operation: string; effect: "allow" | "deny" }>,
    actorId: string | null,
    @MedusaContext() context: Context = {},
  ) {
    const uniqueRoleIds = [...new Set(roleIds)]
    if (uniqueRoleIds.length) {
      const roles = await this.listJovyAuthzRoles({ id: uniqueRoleIds }, {}, context)
      if (roles.length !== uniqueRoleIds.length) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Uno de los roles no existe.")
      }
    }
    for (const policy of policies) assertValidPolicy(policy, false)
    await this.assertNotLastSuperadmin_(userId, uniqueRoleIds, context)

    const currentAssignments = await this.listJovyAuthzAssignments({ user_id: userId }, {}, context)
    if (currentAssignments.length) {
      await this.deleteJovyAuthzAssignments(currentAssignments.map((item) => item.id), context)
    }
    if (uniqueRoleIds.length) {
      await this.createJovyAuthzAssignments(
        uniqueRoleIds.map((roleId) => ({ user_id: userId, role_id: roleId })),
        context,
      )
    }

    const currentPolicies = await this.listJovyAuthzUserPolicies({ user_id: userId }, {}, context)
    if (currentPolicies.length) {
      await this.deleteJovyAuthzUserPolicies(currentPolicies.map((item) => item.id), context)
    }
    if (policies.length) {
      await this.createJovyAuthzUserPolicies(
        policies.map((policy) => ({
          user_id: userId,
          resource: policy.resource,
          operation: policy.operation,
          effect: policy.effect,
        })),
        context,
      )
    }
    await this.recordAudit_(
      {
        actorId,
        action: "user_access_replace",
        targetType: "user",
        targetId: userId,
        metadata: {
          role_ids: uniqueRoleIds,
          policies: policies.map((policy) => `${policy.resource}:${policy.operation}:${policy.effect}`),
        },
      },
      context,
    )
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

  /**
   * Bootstrap explícito de instalación o recuperación. Lo invoca únicamente un
   * comando operativo (`src/scripts/bootstrap-authz.ts`); nunca una petición.
   * - `bootstrap` solo se acepta si el sistema no tiene ningún Superadministrador.
   * - `recovery` se acepta si el operador confirmó explícitamente la recuperación.
   * En ambos casos es idempotente y registra auditoría en la misma transacción.
   */
  @InjectManager()
  async assignBootstrapSuperadmin(
    input: { userId: string; mode: "bootstrap" | "recovery" },
    @MedusaContext() context: Context = {},
  ): Promise<BootstrapResult> {
    return await this.assignBootstrapSuperadmin_(input, context)
  }

  @InjectTransactionManager()
  protected async assignBootstrapSuperadmin_(
    input: { userId: string; mode: "bootstrap" | "recovery" },
    @MedusaContext() context: Context = {},
  ): Promise<BootstrapResult> {
    const [role] = await this.listJovyAuthzRoles({ code: SUPERADMIN_CODE }, {}, context)
    if (!role) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No existe el rol superadmin; ejecuta primero la siembra de roles.",
      )
    }
    const [existing] = await this.listJovyAuthzAssignments(
      { user_id: input.userId, role_id: role.id },
      {},
      context,
    )
    if (existing) return "already"

    const holders = await this.listJovyAuthzAssignments({ role_id: role.id }, {}, context)
    if (input.mode === "bootstrap" && holders.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "La instalación ya tiene un Superadministrador. Usa el procedimiento de recuperación.",
      )
    }

    await this.createJovyAuthzAssignments(
      { user_id: input.userId, role_id: role.id },
      context,
    )
    await this.recordAudit_(
      {
        actorId: null,
        action: BOOTSTRAP_AUDIT_ACTION,
        targetType: "user",
        targetId: input.userId,
        metadata: { role: SUPERADMIN_CODE, mode: input.mode },
      },
      context,
    )
    invalidateAuthzCache(input.userId)
    return "created"
  }
}
