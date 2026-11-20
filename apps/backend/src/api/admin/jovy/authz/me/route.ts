import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTACT_TYPE_RESOURCE } from "@jovy/lib/jovy/authz/catalog"
import { authzError, authzService, currentUser } from "@jovy/lib/jovy/authz/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const user = await currentUser(req)
    const service = authzService(req)
    await service.ensureSystemRoles()
    await service.ensureBootstrapAssignment(user.id, user.email)
    const effective = await service.resolveEffectivePermissions(user.id)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
      },
      roles: effective.roles,
      permissions: [...effective.allow].sort(),
      wildcard: effective.allow.has("*:*"),
      contact_resources: CONTACT_TYPE_RESOURCE,
    })
  } catch (error) {
    authzError(res, error)
  }
}
