import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"
import { useCatalogue } from "../hooks/use-catalogue"
import { CatalogueCategoryCard } from "./category-card"
import { CatalogueCategoryForm } from "./category-form"
import { OfficialCatalogPreview } from "./official-catalog-preview"

/**
 * Pantalla de Categorías del catálogo: seis tarjetas de presentación con clave
 * pública fija. La ruta sólo registra el acceso; el estado vive en el hook y
 * las tarjetas/formulario son componentes de la feature.
 */
export const CataloguePage = () => {
  const permissions = useJovyPermissions()
  const canSeed = permissions.can("jovy_catalogue", "create")
  const canUpdate = permissions.can("jovy_catalogue", "update")
  const {
    categories,
    families,
    medusaCategories,
    loading,
    loadError,
    sideWarning,
    formError,
    editingCategory,
    draft,
    previewUrl,
    saving,
    uploading,
    reordering,
    seeding,
    togglingId,
    toggleError,
    load,
    startEditing,
    cancelEditing,
    changeDraft,
    uploadImage,
    removeImage,
    save,
    toggleComingSoon,
    move,
    seed,
  } = useCatalogue()

  if (editingCategory && draft) {
    return (
      <CatalogueCategoryForm
        category={editingCategory}
        draft={draft}
        medusaCategories={medusaCategories}
        previewUrl={previewUrl}
        uploading={uploading}
        saving={saving}
        error={formError}
        onBack={cancelEditing}
        onChange={changeDraft}
        onUpload={(file) => void uploadImage(file)}
        onRemoveImage={removeImage}
        onSave={() => void save()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-y-4" data-jovy-quality data-testid="jovy-catalogue-page">
      <Container className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1" className="jovy-title">Categorías del catálogo</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Seis tarjetas de presentación para Store. Cada clave pública es fija; el contenido y estado se editan por separado.
            </Text>
          </div>
          <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
            Actualizar
          </Button>
        </div>
        {loadError && (
          <Text size="small" role="alert" className="text-ui-fg-error mt-3">
            {loadError}
          </Text>
        )}
        {sideWarning && (
          <Text size="small" role="status" className="text-ui-fg-subtle mt-3">
            {sideWarning}
          </Text>
        )}
        {toggleError && (
          <Text size="small" role="alert" className="text-ui-fg-error mt-3">
            {toggleError}
          </Text>
        )}
      </Container>

      {loading && categories.length === 0 ? (
        <Container className="p-6">
          <Text className="text-ui-fg-subtle" role="status">
            Cargando categorías…
          </Text>
        </Container>
      ) : categories.length === 0 ? (
        <Container className="p-6">
          <Heading level="h2" className="jovy-subtitle">Todavía no hay tarjetas</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Las tarjetas se crean únicamente con el seed manual; cargar esta pantalla nunca modifica configuración.
          </Text>
          <Button className="mt-4" size="small" variant="secondary" onClick={() => void seed()} isLoading={seeding} disabled={!canSeed}>
            Sembrar seis tarjetas
          </Button>
        </Container>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {categories.map((category, index) => {
              const categoryFamilies = families.filter(
                (family) => category.medusa_category_id && family.medusa_category_id === category.medusa_category_id,
              )
              return (
                <CatalogueCategoryCard
                  key={category.id}
                  category={category}
                  position={index}
                  total={categories.length}
                  families={categoryFamilies}
                  medusaCategories={medusaCategories}
                  reordering={reordering}
                  comingSoonPending={togglingId === category.id}
                  onEdit={() => startEditing(category)}
                  onMove={(direction) => void move(index, direction)}
                  canUpdate={canUpdate}
                  onToggleComingSoon={() => void toggleComingSoon(category)}
                />
              )
            })}
          </div>
        </>
      )}
      <OfficialCatalogPreview />
    </div>
  )
}
