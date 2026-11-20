import { Button, Container, Heading, Text } from "@medusajs/ui"

type Props = {
  loading: boolean
  eventsCount: number
  onCreate: () => void
  onClearFilters: () => void
}

/**
 * Estados sin tarjetas: carga inicial, bandeja vacía y filtros sin coincidencias.
 * Cada uno explica la siguiente acción en lugar de dejar el contenedor mudo.
 */
export const NoveltiesEmptyState = ({
  loading,
  eventsCount,
  onCreate,
  onClearFilters,
}: Props) => {
  if (loading && eventsCount === 0) {
    return (
      <Container className="p-6">
        <Text className="text-ui-fg-subtle" role="status">
          Cargando novedades…
        </Text>
      </Container>
    )
  }

  if (eventsCount === 0) {
    return (
      <Container className="p-6">
        <Heading level="h2" className="jovy-subtitle">Todavía no hay novedades</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Crea la primera novedad con su multimedia para que aparezca en el carrusel de Store.
        </Text>
        <Button className="mt-4" size="small" onClick={onCreate}>
          Crear la primera novedad
        </Button>
      </Container>
    )
  }

  return (
    <Container className="p-6">
      <Heading level="h2" className="jovy-subtitle">Ninguna novedad coincide</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Ajusta la búsqueda o limpia los filtros para volver al orden completo del carrusel.
      </Text>
      <Button className="mt-4" size="small" variant="secondary" onClick={onClearFilters}>
        Limpiar filtros
      </Button>
    </Container>
  )
}
