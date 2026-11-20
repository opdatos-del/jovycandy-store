import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { JOVY_AUTHZ_MODULE } from "@jovy/modules/jovy-authz"
import type JovyAuthzModuleService from "@jovy/modules/jovy-authz/service"

export type AuthContext = { actor_id?: string | null; actor_type?: string | null }

export function currentActorId(req: MedusaRequest) {
  return (req as MedusaRequest & { auth_context?: AuthContext }).auth_context?.actor_id ?? null
}

export function authzService(req: MedusaRequest) {
  return req.scope.resolve(JOVY_AUTHZ_MODULE) as JovyAuthzModuleService
}

export async function currentUser(req: MedusaRequest) {
  const userId = currentActorId(req)
  if (!userId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Sesión no válida.")
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "user",
    fields: ["id", "email", "first_name", "last_name"],
    filters: { id: userId },
  })
  const user = data[0] as
    | { id: string; email: string; first_name?: string | null; last_name?: string | null }
    | undefined
  if (!user) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Sesión no válida.")
  }
  return user
}

export async function userById(req: MedusaRequest, id: string) {
  const userModule = req.scope.resolve(Modules.USER)
  return userModule.retrieveUser(id)
}

export function authzError(res: MedusaResponse, error: unknown) {
  if (error instanceof MedusaError) {
    const status =
      error.type === MedusaError.Types.NOT_FOUND
        ? 404
        : error.type === MedusaError.Types.NOT_ALLOWED ||
            error.type === MedusaError.Types.UNAUTHORIZED
          ? 403
          : 400
    return res.status(status).json({
      type: status === 403 ? "not_allowed" : "invalid_data",
      message: error.message,
    })
  }
  return res.status(500).json({
    type: "unknown_error",
    message: "No se pudo completar la operación.",
  })
}
