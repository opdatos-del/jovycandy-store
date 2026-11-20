import { Container, Heading, Text } from "@medusajs/ui"
import type { ReactNode } from "react"

type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  /** Contenido adicional bajo la cabecera, dentro del mismo Container. */
  children?: ReactNode
  className?: string
}

/**
 * Cabecera común de las pantallas del CMS. Conserva la jerarquía visual
 * `jovy-title` + texto atenuado y deja las acciones a la derecha con wrap
 * responsive. No impone estructura a las tarjetas ni a los filtros.
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
  className = "p-4 sm:p-6",
}: PageHeaderProps) {
  return (
    <Container className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading level="h1" className="jovy-title">
            {title}
          </Heading>
          {description && (
            <Text size="small" className="text-ui-fg-subtle mt-1">
              {description}
            </Text>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Container>
  )
}
