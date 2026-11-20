import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  AUTHZ_OPERATIONS,
  AUTHZ_RESOURCES,
  CONTACT_TYPE_RESOURCE,
  SYSTEM_ROLE_TEMPLATES,
} from "@jovy/lib/jovy/authz/catalog"
import { NATIVE_AREA_INVENTORY, SHELL_READ_PATTERNS } from "@jovy/lib/jovy/authz/route-policy"

/**
 * Catálogo visible para la pantalla de accesos. No expone políticas de usuarios
 * ni datos personales.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({
    resources: AUTHZ_RESOURCES,
    operations: AUTHZ_OPERATIONS,
    contact_types: CONTACT_TYPE_RESOURCE,
    roles: SYSTEM_ROLE_TEMPLATES.map((role) => ({
      code: role.code,
      name: role.name,
      description: role.description,
    })),
    native_areas: NATIVE_AREA_INVENTORY.map((area) => ({
      prefix: area.prefix,
      resource: area.resource,
      settings: Boolean(area.settings),
    })),
    shell_reads: SHELL_READ_PATTERNS.map((pattern) => pattern.source),
    limitations: [
      "El módulo RBAC Enterprise de Medusa no está licenciado; esta capa es propia.",
      "Las superficies nativas se protegen por prefijo, no por la política oficial de Medusa.",
      "Una actualización de Medusa puede añadir rutas nativas que quedan denegadas hasta clasificarlas.",
    ],
  })
}
