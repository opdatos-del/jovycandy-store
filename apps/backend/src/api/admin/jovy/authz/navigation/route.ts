import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getAuthz } from "@jovy/lib/jovy/authz/permissions"
import { visibleNavigation } from "@jovy/lib/jovy/authz/navigation"

/**
 * Navegación administrativa efectiva del actor. Es la representación de los
 * permisos, no una fuente de autoridad: cada ruta sigue validándose en el
 * middleware y en el handler.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const authz = getAuthz(req)
  if (!authz) {
    return res.status(403).json({ type: "not_allowed", message: "No autorizado para esta operación." })
  }
  res.json({
    groups: visibleNavigation(authz),
    roles: authz.roles,
    wildcard: authz.wildcard,
  })
}
