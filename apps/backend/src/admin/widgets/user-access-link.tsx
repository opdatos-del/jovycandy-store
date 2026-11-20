import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"
import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"

/**
 * Enlace de descubrimiento dentro de Settings → Users. La gestión completa de
 * roles vive en Settings → Accesos y permisos; la asignación por persona vive
 * en el detalle de cada usuario (`user.details`).
 */
const UserAccessLink = () => {
  const permissions = useJovyPermissions()
  if (permissions.loading || !permissions.can("jovy_access", "read")) return null

  return (
    <Container className="p-4 sm:p-6" data-testid="jovy-user-access-link">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level="h2" className="text-base">
            Accesos Jovy
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Roles del CMS y de contactos. Abre la ficha de un usuario para asignarle roles o
            administra el catálogo completo.
          </Text>
        </div>
        <a href="/app/settings/access" className="text-ui-fg-interactive text-sm underline">
          Administrar roles y permisos
        </a>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "user.list" })

export default UserAccessLink
