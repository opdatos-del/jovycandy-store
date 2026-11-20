import { Button, Container, Heading, Text } from "@medusajs/ui"
import { searchPublishedProducts, uploadLaunchImage } from "../api"
import { useLaunchForm } from "../hooks/use-launch-form"
import { useLaunchList } from "../hooks/use-launch-list"
import { useLaunchSettings } from "../hooks/use-launch-settings"
import { useLaunches } from "../hooks/use-launches"
import { LaunchCard } from "./launch-card"
import { LaunchColorSettings } from "./launch-color-settings"
import { LaunchForm } from "./launch-form"

/**
 * Administración de Nuevos Lanzamientos. Cada tarjeta usa un producto publicado
 * del catálogo, una imagen propia o ambos; el orden es global y el color de
 * fondo se comparte con Store.
 */
export const LaunchesPage = () => {
  const query = useLaunches()
  const form = useLaunchForm({ launches: query.launches, reload: query.load })
  const list = useLaunchList({
    launches: query.launches,
    reload: query.load,
    onDeleted: form.forgetEditing,
  })
  const color = useLaunchSettings({
    colorDraft: query.colorDraft,
    setColorDraft: query.setColorDraft,
    applySettings: query.applySettings,
  })

  const editingProduct = form.editing?.product_id
    ? query.productNames[form.editing.product_id] ??
      { id: form.editing.product_id, title: form.editing.product_id }
    : null

  return (
    <div className="flex flex-col gap-y-4" data-jovy-quality data-testid="jovy-launches-page">
      <Container className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1" className="jovy-title">Nuevos lanzamientos</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Configura tarjetas de la sección de portada. Cada lanzamiento usa un producto publicado, una imagen propia
              o ambas cosas; el orden es global.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" onClick={() => void query.load()} isLoading={query.loading}>
              Actualizar
            </Button>
            <Button size="small" onClick={form.startNew}>
              Nuevo Slide
            </Button>
          </div>
        </div>
        {query.loadError && (
          <p role="alert" className="text-ui-fg-error mt-3 text-sm">
            {query.loadError}
          </p>
        )}
      </Container>

      <LaunchColorSettings
        settings={query.settings}
        colorDraft={query.colorDraft}
        colorValid={color.colorValid}
        saving={color.settingsSaving}
        error={color.settingsError}
        onChange={color.changeColor}
        onSave={() => void color.saveSettings()}
      />

      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Heading level="h2" className="jovy-subtitle">Lanzamientos</Heading>
          {!query.loading && <Text size="small" className="text-ui-fg-subtle">{query.launches.length} en orden global</Text>}
        </div>
        {query.loading && query.launches.length === 0 ? (
          <Text className="text-ui-fg-subtle mt-4" role="status">
            Cargando lanzamientos…
          </Text>
        ) : query.launches.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-ui-border-base p-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              Aún no hay lanzamientos. Crea el primero para que aparezca en la portada.
            </Text>
            <Button className="mt-4" size="small" onClick={form.startNew}>Crear primer lanzamiento</Button>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]" aria-label="Lanzamientos">
            {query.launches.map((launch, index) => (
              <LaunchCard
                key={launch.id}
                launch={launch}
                index={index}
                isFirst={index === 0}
                isLast={index === query.launches.length - 1}
                product={launch.product_id ? query.productNames[launch.product_id] : undefined}
                reordering={list.reordering}
                changing={list.changingId === launch.id}
                deleting={list.deletingId === launch.id}
                onMove={(direction) => void list.move(index, direction)}
                onToggleActive={() => void list.toggleActive(launch)}
                onEdit={() => form.startEditing(launch)}
                onDelete={() => void list.remove(launch)}
              />
            ))}
          </ul>
        )}
      </Container>

      {form.formOpen && (
        <LaunchForm
          key={`${form.editing?.id ?? "new"}-${form.formVersion}`}
          editing={form.editing}
          initialProduct={editingProduct}
          saving={form.saving}
          error={form.formError}
          onCancel={form.closeForm}
          onSubmit={(draft) => void form.saveLaunch(draft)}
          onUpload={uploadLaunchImage}
          searchProducts={searchPublishedProducts}
        />
      )}
    </div>
  )
}
