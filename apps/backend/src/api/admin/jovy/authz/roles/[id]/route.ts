import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { roleUpdateSchema } from "@jovy/lib/jovy/authz/schemas"
import { authzError, authzService, currentActorId } from "@jovy/lib/jovy/authz/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service = authzService(req)
    const roles = await service.listRolesWithPolicies()
    const role = roles.find((item) => item.id === req.params.id)
    if (!role) return res.status(404).json({ message: "Rol no encontrado" })
    res.json({ role })
  } catch (error) {
    authzError(res, error)
  }
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const parsed = roleUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "El rol no es válido", errors: parsed.error.flatten() })
  }
  try {
    const service = authzService(req)
    await service.updateRoleMeta(req.params.id, parsed.data, currentActorId(req))
    const roles = await service.listRolesWithPolicies()
    res.json({ role: roles.find((item) => item.id === req.params.id) })
  } catch (error) {
    authzError(res, error)
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    await authzService(req).deleteCustomRole(req.params.id, currentActorId(req))
    res.status(204).send()
  } catch (error) {
    authzError(res, error)
  }
}
