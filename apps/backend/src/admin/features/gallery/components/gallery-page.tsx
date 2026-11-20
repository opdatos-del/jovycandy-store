import { Container, Heading } from "@medusajs/ui"
import { BrandGalleryManager } from "./gallery-manager"

/**
 * Pantalla «Casa Jovy Galería». El encabezado y el gestor viven aquí; la ruta
 * solo registra el acceso y mantiene el mismo menú del Admin.
 */
export const GalleryPage = () => {
  return <div className="flex flex-col gap-y-4" data-jovy-quality>
    <Container className="p-6">
      <Heading level="h1" className="jovy-title">Casa Jovy Galería</Heading>
      <p className="text-ui-fg-subtle text-sm">
        Galería de imágenes de Casa Jovy: publica, ordena y programa sus elementos.
      </p>
    </Container>

    <BrandGalleryManager />
  </div>
}
