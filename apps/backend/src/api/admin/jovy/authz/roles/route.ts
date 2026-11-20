import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { roleCreateSchema } from "@jovy/lib/jovy/authz/schemas"
import { getAuthz } from "@jovy/lib/jovy/authz/permissions"
import { authzError, authzService, currentActorId } from "@jovy/lib/jovy/authz/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const roles = await authzService(req).listRolesWithPolicies()
    res.json({ roles })
  } catch (error) {
    authzError(res, error)
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = roleCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "El rol no es válido", errors: parsed.error.flatten() })
  }
  try {
    const actor = getAuthz(req)
    if (!actor) {
      return res.status(403).json({ type: "not_allowed", message: "No autorizado para esta operación." })
    }
    if (!actor.wildcard && parsed.data.policies.some((policy) => !actor.can(policy.resource, policy.operation))) {
      return res.status(403).json({
        type: "not_allowed",
        message: "No puedes delegar permisos que no tienes.",
      })
    }
    const service = authzService(req)
    const role = await service.createCustomRole(parsed.data, currentActorId(req))
    const roles = await service.listRolesWithPolicies()
    res.status(201).json({ role: roles.find((item) => item.id === role.id) })
  } catch (error) {
    authzError(res, error)
  }
}
