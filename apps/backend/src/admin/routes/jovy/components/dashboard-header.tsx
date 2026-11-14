import { ArrowPath, SquaresPlus } from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { AUTO_REFRESH_SECONDS, formatDateTime } from "./dashboard-model"

type DashboardHeaderProps = {
  generatedAt: string | null
  isRefreshing: boolean
  onRefresh: () => void
}

export function DashboardHeader({ generatedAt, isRefreshing, onRefresh }: DashboardHeaderProps) {
  return (
    <Container className="px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="bg-ui-bg-subtle text-ui-fg-interactive flex size-9 items-center justify-center rounded-md"
            >
              <SquaresPlus />
            </span>
            <Text
              size="xsmall"
              weight="plus"
              leading="compact"
              className="text-ui-fg-subtle tracking-widest uppercase"
            >
              JovyCandy CMS
            </Text>
          </div>
          <Heading level="h1" className="mt-2">
            Dashboard
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Resumen operativo con datos reales de Medusa y de los módulos Jovy.
          </Text>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
            <Text size="xsmall" className="text-ui-fg-muted" data-testid="jovy-dashboard-updated">
              {generatedAt ? (
                <>
                  Actualizado{" "}
                  <time dateTime={generatedAt}>{formatDateTime(generatedAt)}</time>
                </>
              ) : (
                "Aún sin datos cargados."
              )}
            </Text>
            <span aria-hidden className="text-ui-fg-muted hidden sm:inline">
              ·
            </span>
            <Text size="xsmall" className="text-ui-fg-muted">
              Refresco automático cada {AUTO_REFRESH_SECONDS} s; se pausa en pestaña oculta.
            </Text>
          </div>
        </div>
        <Button
          size="small"
          variant="secondary"
          isLoading={isRefreshing}
          onClick={onRefresh}
          aria-label="Actualizar datos del dashboard"
          data-testid="jovy-dashboard-refresh"
          className="w-full shrink-0 sm:w-auto"
        >
          <ArrowPath />
          Actualizar
        </Button>
      </div>
    </Container>
  )
}
