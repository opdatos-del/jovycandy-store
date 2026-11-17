import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Users } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect } from "react"

/** Ruta nativa de usuarios del Admin de Medusa (basename `/app`). */
const NATIVE_USERS_URL = "/app/settings/users"

/**
 * «Usuarios» es un acceso directo al gestor nativo, no un sistema de identidad
 * paralelo. Se redirige en cliente y se deja un enlace visible como respaldo.
 */
const UsersPage = () => {
  useEffect(() => {
    window.location.assign(NATIVE_USERS_URL)
  }, [])

  return (
    <Container className="p-6" data-testid="jovy-users-redirect">
      <Heading level="h1">Usuarios</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-2" role="status">
        Redirigiendo al gestor nativo de usuarios de Medusa…
      </Text>
      <Button asChild size="small" variant="secondary" className="mt-4">
        <a href={NATIVE_USERS_URL}>Abrir usuarios</a>
      </Button>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Usuarios",
  icon: Users,
  rank: 9,
})

export default UsersPage
