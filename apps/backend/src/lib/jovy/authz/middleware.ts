import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { JOVY_AUTHZ_MODULE } from "@jovy/modules/jovy-authz"
import type JovyAuthzModuleService from "@jovy/modules/jovy-authz/service"
import { readAuthzCache, writeAuthzCache } from "./cache"
import {
  effectivePermissionKeys,
  isGlobalAdmin,
  permissionAllows,
  type AuthzSnapshot,
} from "./permissions"
import {
  evaluateJovyAccess,
  evaluateNativeAccess,
  isAmbiguousPath,
  isAuthenticatedShellRead,
  isPublicShellRead,
  matchJovyRule,
} from "./route-policy"

type AuthContext = { actor_id?: string | null; actor_type?: string | null }
type RequestWithAuth = MedusaRequest & {
  auth_context?: AuthContext
  jovy_authz?: AuthzSnapshot
}
function pathnameOf(req: MedusaRequest) {
  const original = (req as MedusaRequest & { originalUrl?: string }).originalUrl ?? req.url ?? ""
  return original.split("?")[0] || "/"
}

function deny(res: MedusaResponse, status: 401 | 403, message: string) {
  res.status(status).json({
    type: status === 401 ? "unauthorized" : "not_allowed",
    message,
  })
}

async function assertUserExists(req: MedusaRequest, userId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "user",
    fields: ["id"],
    filters: { id: userId },
  })
  if (!data.length) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Usuario no válido.")
  }
}

async function resolveSnapshot(req: MedusaRequest, userId: string): Promise<AuthzSnapshot> {
  // La existencia del usuario no se cachea: un usuario eliminado pierde el
  // acceso en la siguiente petición, sin esperar el TTL de permisos.
  await assertUserExists(req, userId)

  const cached = readAuthzCache(userId)
  if (cached) return cached

  const service = req.scope.resolve(JOVY_AUTHZ_MODULE) as JovyAuthzModuleService
  const effective = await service.resolveEffectivePermissions(userId)
  const wildcard = isGlobalAdmin(effective.allow, effective.deny)
  const snapshot: AuthzSnapshot = {
    userId,
    roles: effective.roles,
    permissions: effectivePermissionKeys(effective.allow, effective.deny),
    wildcard,
    can: (resource, operation) =>
      permissionAllows(effective.allow, effective.deny, resource, operation),
  }
  writeAuthzCache(userId, snapshot)
  return snapshot
}

/**
 * Autorización administrativa global. Se ejecuta después de `authenticate`, así
 * que una petición sin sesión nunca llega aquí. Deniega por defecto:
 *  - `/admin/jovy/**` exige una regla del inventario y el permiso declarado.
 *  - Contactos por ID se resuelven en el handler, que conoce el tipo real.
 *  - `/admin/**` nativo se clasifica por prefijo; lo no clasificado se deniega.
 *  - Las lecturas mínimas del shell quedan permitidas para que la UI muestre el
 *    estado de acceso sin exponer datos de negocio.
 */
export async function authorizeJovyAdmin(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const auth = (req as RequestWithAuth).auth_context
  const userId = auth?.actor_id
  const pathname = pathnameOf(req)

  if (isAmbiguousPath(pathname)) {
    return deny(res, 403, "No autorizado para esta operación.")
  }

  // Única lectura del shell que se consulta antes de existir una sesión útil:
  // el dashboard necesita conocer las feature flags para arrancar. No devuelve
  // datos de negocio ni de otras personas.
  if (isPublicShellRead(req.method, pathname)) return next()

  // Cualquier otra excepción del shell exige una sesión administrativa válida.
  // El orden importa: nunca se evalúan excepciones antes de validar identidad.
  if (!userId || auth?.actor_type !== "user") {
    return deny(res, 401, "Sesión no válida.")
  }

  let snapshot: AuthzSnapshot
  try {
    snapshot = await resolveSnapshot(req, userId)
  } catch (error) {
    if (error instanceof MedusaError && error.type === MedusaError.Types.UNAUTHORIZED) {
      return deny(res, 401, "Sesión no válida.")
    }
    return deny(res, 403, "No autorizado para esta operación.")
  }
  ;(req as RequestWithAuth).jovy_authz = snapshot

  // Lecturas mínimas necesarias para pintar el shell. Ya se validó identidad y
  // existencia del usuario; no conceden acceso a datos de negocio.
  if (isAuthenticatedShellRead(req.method, pathname)) return next()

  if (pathname.startsWith("/admin/jovy/")) {
    const rule = matchJovyRule(req.method, pathname)
    if (!rule) return deny(res, 403, "No autorizado para esta operación.")
    const decision = evaluateJovyAccess(req, snapshot, rule)
    if (!decision.allowed) return deny(res, 403, "No autorizado para esta operación.")
    return next()
  }

  const decision = evaluateNativeAccess(req.method, pathname, snapshot)
  if (!decision.allowed) return deny(res, 403, "No autorizado para esta operación.")
  return next()
}
