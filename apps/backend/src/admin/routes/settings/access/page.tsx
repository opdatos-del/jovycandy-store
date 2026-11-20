import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Users } from "@medusajs/icons"
import { AccessPage } from "@admin/features/access/components/access-page"

/**
 * Catálogo global de roles y políticas dentro de Settings. La asignación de
 * roles a una persona vive en el detalle nativo de Usuarios (`user.details`);
 * esta ruta administra el catálogo, no la identidad.
 */
export const config = defineRouteConfig({
  label: "Accesos y permisos",
  icon: Users,
  rank: 6,
  permissions: "jovy_access:read",
})

export default AccessPage
