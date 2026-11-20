import { Button, Container, Heading, Input, usePrompt } from "@medusajs/ui"
import { useHero } from "../hooks/use-hero"
import { HeroFormSection } from "./hero-form"
import { HeroList } from "./hero-list"
import type { Hero } from "../types"

/**
 * Administración del Hero corporativo. La pantalla compone listado, formulario
 * y color global; el acceso al contrato y el estado viven en `useHero`.
 */
export const HeroManager = () => {
  const prompt = usePrompt()
  const hero = useHero()

  const remove = async (item: Hero) => {
    const confirmed = await prompt({
      title: "Eliminar Hero",
      description: `Se eliminará definitivamente “${item.translations.es.title}”. Dejará de mostrarse en Store y su archivo multimedia permanece en el almacenamiento compartido.`,
      confirmText: "Eliminar Hero",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    await hero.remove(item)
  }

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Heading level="h1">Hero corporativo</Heading>
            <p className="text-ui-fg-subtle text-sm">
              Contenido bilingüe, programación, multimedia y producto destacado.
            </p>
          </div>
          <Button variant="secondary" onClick={hero.resetForm}>
            Nuevo Hero
          </Button>
        </div>
        {hero.message && (
          <p role="alert" className="mt-3 text-ui-fg-error">
            {hero.message}
          </p>
        )}
      </Container>

      <HeroList
        items={hero.items}
        loading={hero.loading}
        deletingId={hero.deletingId}
        onMove={hero.move}
        onEdit={hero.edit}
        onStatus={hero.updateStatus}
        onRemove={remove}
      />

      <HeroFormSection
        form={hero.form}
        setForm={hero.setForm}
        editingId={hero.editingId}
        saving={hero.saving}
        product={hero.product}
        products={hero.products}
        productQuery={hero.productQuery}
        setProductQuery={hero.setProductQuery}
        previewUrl={hero.previewUrl}
        onProductChange={hero.setProduct}
        onSearchProducts={hero.searchProducts}
        onUpload={hero.upload}
        onSubmit={hero.save}
      />

      <Container className="p-6">
        <Heading level="h2">Color global</Heading>
        <div className="mt-3 flex max-w-md gap-2">
          <Input
            aria-label="Color global Hero"
            value={hero.settingsColor}
            onChange={(event) => hero.setSettingsColor(event.target.value)}
          />
          <Button isLoading={hero.saving} onClick={() => void hero.saveSettings()}>
            Guardar
          </Button>
        </div>
      </Container>
    </div>
  )
}
