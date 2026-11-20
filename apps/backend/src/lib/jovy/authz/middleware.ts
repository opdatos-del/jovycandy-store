import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { JOVY_AUTHZ_MODULE } from "@jovy/modules/jovy-authz"
import type JovyAuthzModuleService from "@jovy/modules/jovy-authz/service"
import { invalidateAuthzCache, readAuthzCache, writeAuthzCache } from "./cache"
import {
  permissionAllows,
  type AuthzSnapshot,
} from "./permissions"
import {
  evaluateJovyAccess,
  evaluateNativeAccess,
  isShellRead,
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

async function resolveEmail(req: MedusaRequest, userId: string) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "user",
      fields: ["id", "email"],
      filters: { id: userId },
    })
    return (data[0] as { email?: string } | undefined)?.email ?? null
  } catch {
    return null
  }
}

async function resolveSnapshot(req: MedusaRequest, userId: string): Promise<AuthzSnapshot> {
  const cached = readAuthzCache(userId)
  if (cached) return cached

  const service = req.scope.resolve(JOVY_AUTHZ_MODULE) as JovyAuthzModuleService
  // Idempotente: crea solo los roles ausentes. Se ejecuta en cada caché miss
  // para que un entorno restaurado o un proceso nuevo no dependa de una
  // bandera en memoria.
  await service.ensureSystemRoles()

  const email = await resolveEmail(req, userId)
  if (!email) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Usuario autenticado sin registro en el User Module",
    )
  }

  if (await service.ensureBootstrapAssignment(userId, email)) {
    // El bootstrap escribe la asignación; se invalida lo que hubiera en caché.
    invalidateAuthzCache(userId)
  }

  const effective = await service.resolveEffectivePermissions(userId)
  const wildcard = effective.allow.has("*:*")
  const snapshot: AuthzSnapshot = {
    userId,
    roles: effective.roles,
    permissions: [...effective.allow].sort(),
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

  // Lecturas mínimas del shell: se dejan pasar y la autenticación nativa de la
  // ruta decide. `/admin/feature-flags` se consulta durante el arranque del
  // dashboard, antes de que exista una sesión útil.
  if (isShellRead(req.method, pathname)) return next()

  if (!userId || auth?.actor_type !== "user") {
    return deny(res, 401, "Sesión no válida.")
  }
  let snapshot: AuthzSnapshot
  try {
    snapshot = await resolveSnapshot(req, userId)
  } catch {
    return deny(res, 403, "No autorizado para esta operación.")
  }
  ;(req as RequestWithAuth).jovy_authz = snapshot

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
