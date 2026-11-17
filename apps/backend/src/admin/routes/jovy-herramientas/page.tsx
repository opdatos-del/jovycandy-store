import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Wrench } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"

/**
 * Grupo hermano de JovyCandy CMS. Aquí viven las herramientas aditivas que no
 * formaban parte del administrador histórico, para no mezclarlas con las
 * entradas canónicas del sidebar.
 */
const JovyHerramientasPage = () => (
  <Container className="p-6" data-testid="jovy-herramientas-page">
    <Heading level="h1">JovyCandy · Herramientas</Heading>
    <Text size="small" className="text-ui-fg-subtle mt-2">
      Utilidades adicionales del CMS. Las secciones del administrador histórico
      están bajo «JovyCandy CMS».
    </Text>
    <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Herramientas Jovy">
      {[
        { href: "/app/jovy-herramientas/content", label: "Contenido Jovy" },
        { href: "/app/jovy-herramientas/events", label: "Eventos Jovy" },
        { href: "/app/jovy-herramientas/marketing", label: "Marketing Jovy" },
        { href: "/app/jovy-herramientas/contacts", label: "Contactos Jovy" },
      ].map((tool) => (
        <li key={tool.href}>
          <Button asChild variant="secondary" size="small">
            <a href={tool.href}>{tool.label}</a>
          </Button>
        </li>
      ))}
    </ul>
  </Container>
)

export const config = defineRouteConfig({
  label: "JovyCandy · Herramientas",
  icon: Wrench,
  rank: 1,
})

export default JovyHerramientasPage
