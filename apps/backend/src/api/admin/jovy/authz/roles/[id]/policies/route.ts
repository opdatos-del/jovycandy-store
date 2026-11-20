import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rolePoliciesSchema } from "@jovy/lib/jovy/authz/schemas"
import { getAuthz } from "@jovy/lib/jovy/authz/permissions"
import { authzError, authzService, currentActorId } from "@jovy/lib/jovy/authz/http"

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = rolePoliciesSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Las políticas no son válidas", errors: parsed.error.flatten() })
  }
  try {
    const service = authzService(req)
    const actor = getAuthz(req)
    const actorId = currentActorId(req)
    const roles = await service.listRolesWithPolicies()
    const role = roles.find((item) => item.id === req.params.id)
    if (!role) return res.status(404).json({ message: "Rol no encontrado" })
    if (!actor) {
      return res.status(403).json({ type: "not_allowed", message: "No autorizado para esta operación." })
    }
    if (!actor.wildcard) {
      if (role.code === "superadmin") {
        return res.status(403).json({
          type: "not_allowed",
          message: "Solo un superadministrador puede cambiar el rol global.",
        })
      }
      const ownRoleIds = actorId ? (await service.getUserAccess(actorId)).role_ids : []
      if (ownRoleIds.includes(role.id)) {
        return res.status(403).json({
          type: "not_allowed",
          message: "No puedes modificar un rol que tienes asignado.",
        })
      }
      if (parsed.data.policies.some((policy) => !actor.can(policy.resource, policy.operation))) {
        return res.status(403).json({
          type: "not_allowed",
          message: "No puedes delegar permisos que no tienes.",
        })
      }
    }
    await service.replaceRolePolicies(role.id, parsed.data.policies, currentActorId(req))
    const updated = await service.listRolesWithPolicies()
    res.json({ role: updated.find((item) => item.id === role.id) })
  } catch (error) {
    authzError(res, error)
  }
}
