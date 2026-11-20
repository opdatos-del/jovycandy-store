import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"

type Props = {
  eventsCount: number
  storeVisibleCount: number
  loading: boolean
  loadError: string | null
  sideWarning: string | null
  actionError: string | null
  onCreate: () => void
  onReload: () => void
}

/** Encabezado de la bandeja: título, acciones y avisos de carga. */
export const NoveltiesHeader = ({
  eventsCount,
  storeVisibleCount,
  loading,
  loadError,
  sideWarning,
  actionError,
  onCreate,
  onReload,
}: Props) => (
  <Container className="p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Heading level="h1" className="jovy-title">Novedades</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Carrusel horizontal de Store. Cada novedad reutiliza el evento de Eventos Jovy: aquí se administran la
          multimedia, la vigencia, el orden y la visibilidad.
        </Text>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="small" onClick={onCreate}>
          Nueva novedad
        </Button>
        <Button size="small" variant="secondary" onClick={onReload} isLoading={loading}>
          Actualizar
        </Button>
        <Button asChild size="small" variant="secondary">
          <a href="/app/jovy-herramientas/events">Abrir Eventos Jovy</a>
        </Button>
      </div>
    </div>

    {/* Dos cifras bastan para situar la bandeja: el desglose por estado ya
        vive en la insignia de cada tarjeta y en los filtros. */}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Badge color="purple">
        {eventsCount} {eventsCount === 1 ? "novedad" : "novedades"}
      </Badge>
      <Badge color="green">
        {storeVisibleCount} {storeVisibleCount === 1 ? "visible ahora" : "visibles ahora"}
      </Badge>
    </div>

    {loadError && (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Text size="small" role="alert" className="text-ui-fg-error">
          {loadError}
        </Text>
        <Button size="small" variant="secondary" onClick={onReload}>
          Reintentar
        </Button>
      </div>
    )}
    {sideWarning && (
      <Text size="small" role="status" className="text-ui-fg-subtle mt-3">
        {sideWarning}
      </Text>
    )}
    {actionError && (
      <Text size="small" role="alert" className="text-ui-fg-error mt-3">
        {actionError}
      </Text>
    )}
  </Container>
)
