import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { userAccessSchema } from "@jovy/lib/jovy/authz/schemas"
import { getAuthz } from "@jovy/lib/jovy/authz/permissions"
import {
  authzError,
  authzService,
  currentActorId,
  userById,
} from "@jovy/lib/jovy/authz/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service = authzService(req)
    const user = await userById(req, req.params.id)
    const access = await service.getUserAccess(user.id)
    const roles = access.role_ids.length
      ? await service.listJovyAuthzRoles({ id: access.role_ids })
      : []
    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
      },
      role_ids: access.role_ids,
      roles: roles.map((role) => role.code),
      policies: access.policies,
    })
  } catch (error) {
    authzError(res, error)
  }
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = userAccessSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Los accesos no son válidos", errors: parsed.error.flatten() })
  }
  try {
    const actorId = currentActorId(req)
    if (!actorId || actorId === req.params.id) {
      return res.status(403).json({
        type: "not_allowed",
        message: "Ningún usuario puede modificar sus propios accesos.",
      })
    }

    const target = await userById(req, req.params.id)
    const service = authzService(req)
    const actor = getAuthz(req)
    if (!actor) {
      return res.status(403).json({ type: "not_allowed", message: "No autorizado para esta operación." })
    }

    const allRoles = await service.listRolesWithPolicies()
    const selected = parsed.data.role_ids.map((roleId) => {
      const role = allRoles.find((item) => item.id === roleId)
      if (!role) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Uno de los roles no existe.")
      }
      return role
    })

    if (!actor.wildcard) {
      for (const role of selected) {
        if (role.code === "superadmin") {
          return res.status(403).json({
            type: "not_allowed",
            message: "No puedes delegar un rol con más privilegios de los que tienes.",
          })
        }
        for (const policy of role.policies) {
          if (!actor.can(policy.resource, policy.operation)) {
            return res.status(403).json({
              type: "not_allowed",
              message: "No puedes delegar un rol con más privilegios de los que tienes.",
            })
          }
        }
      }
      for (const policy of parsed.data.policies) {
        if (policy.effect === "allow" && !actor.can(policy.resource, policy.operation)) {
          return res.status(403).json({
            type: "not_allowed",
            message: "No puedes delegar un permiso que no tienes.",
          })
        }
      }
    }

    await service.replaceUserAccess(target.id, parsed.data.role_ids, parsed.data.policies, actorId)
    const access = await service.getUserAccess(target.id)
    res.json({
      user: {
        id: target.id,
        email: target.email,
        first_name: target.first_name ?? null,
        last_name: target.last_name ?? null,
      },
      role_ids: access.role_ids,
      roles: selected.map((role) => role.code),
      policies: access.policies,
    })
  } catch (error) {
    authzError(res, error)
  }
}
