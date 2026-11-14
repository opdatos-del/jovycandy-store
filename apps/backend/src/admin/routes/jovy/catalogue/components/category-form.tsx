import { Badge, Button, Container, Heading, Input, Switch, Text, Textarea } from "@medusajs/ui"
import type { CatalogueCategory, CatalogueDraft, MedusaCategory } from "./catalogue-types"

type Props = {
  category: CatalogueCategory
  draft: CatalogueDraft
  medusaCategories: MedusaCategory[]
  previewUrl: string | null
  uploading: boolean
  saving: boolean
  error: string | null
  onBack: () => void
  onChange: (patch: Partial<CatalogueDraft>) => void
  onUpload: (file: File) => void
  onRemoveImage: () => void
  onSave: () => void
}

const fieldClass =
  "border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive w-full rounded-md border px-2 py-1.5 text-sm outline-hidden focus-visible:ring-2"

const labelClass = "text-ui-fg-subtle text-xs font-medium"

const statusLabel = (draft: CatalogueDraft) => {
  if (draft.coming_soon) return "Próximamente"
  return draft.active ? "Activa" : "Inactiva"
}

const statusColor = (draft: CatalogueDraft): "orange" | "green" | "grey" => {
  if (draft.coming_soon) return "orange"
  return draft.active ? "green" : "grey"
}

export const CatalogueCategoryForm = ({
  category,
  draft,
  medusaCategories,
  previewUrl,
  uploading,
  saving,
  error,
  onBack,
  onChange,
  onUpload,
  onRemoveImage,
  onSave,
}: Props) => (
  <div data-testid="catalogue-category-form" className="flex flex-col gap-y-4">
    <Container className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button size="small" variant="transparent" onClick={onBack} disabled={saving}>
            Volver a categorías
          </Button>
          <Heading level="h1" className="mt-3">
            Editar categoría
          </Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Configura la tarjeta pública <code className="font-mono">{category.key}</code> sin alterar su clave.
          </Text>
        </div>
        <Badge color={statusColor(draft)}>{statusLabel(draft)}</Badge>
      </div>
    </Container>

    <Container className="p-6">
      <form
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <section className="border-ui-border-base bg-ui-bg-base lg:col-span-8 flex min-w-0 flex-col gap-y-4 rounded-lg border p-5">
          <div>
            <Heading level="h2">Contenido de la tarjeta</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Nombre, descripción, imagen y categoría comercial visibles para la operación del catálogo.
            </Text>
          </div>

          <div className="flex flex-col gap-y-1">
            <label htmlFor="catalogue-category-name" className={labelClass}>
              Nombre
            </label>
            <Input
              id="catalogue-category-name"
              required
              minLength={2}
              maxLength={180}
              value={draft.name}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-y-1">
            <label htmlFor="catalogue-category-description" className={labelClass}>
              Descripción
            </label>
            <Textarea
              id="catalogue-category-description"
              maxLength={2000}
              value={draft.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-y-1">
              <label htmlFor="catalogue-category-key" className={labelClass}>
                Clave pública
              </label>
              <Input id="catalogue-category-key" value={category.key} readOnly aria-readonly />
              <Text size="xsmall" className="text-ui-fg-subtle">
                La clave es fija para no romper enlaces del storefront.
              </Text>
            </div>
            <div className="flex flex-col gap-y-1">
              <label htmlFor="catalogue-medusa-category" className={labelClass}>
                Categoría comercial de Medusa
              </label>
              <select
                id="catalogue-medusa-category"
                className={fieldClass}
                value={draft.medusa_category_id}
                onChange={(event) => onChange({ medusa_category_id: event.target.value })}
              >
                <option value="">Sin categoría comercial</option>
                {medusaCategories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Vincula familias y productos de la taxonomía comercial.
              </Text>
            </div>
          </div>

          <div className="border-ui-border-base rounded-md border p-4">
            <div className="flex flex-col gap-y-1">
              <label htmlFor="catalogue-category-image" className={labelClass}>
                Imagen opcional (PNG, JPEG o WebP, máximo 5 MB)
              </label>
              <Input
                id="catalogue-category-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onUpload(file)
                }}
              />
              {uploading && (
                <Text size="xsmall" className="text-ui-fg-subtle" role="status">
                  Subiendo imagen…
                </Text>
              )}
            </div>
            {previewUrl && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <img
                  src={previewUrl}
                  alt={`Vista previa de ${draft.name}`}
                  className="border-ui-border-base h-20 w-28 rounded-md border object-cover"
                />
                <Button type="button" size="small" variant="secondary" onClick={onRemoveImage} disabled={saving}>
                  Quitar imagen
                </Button>
              </div>
            )}
            <div className="mt-3 flex flex-col gap-y-1">
              <label htmlFor="catalogue-category-image-url" className={labelClass}>
                URL externa opcional (HTTPS)
              </label>
              <Input
                id="catalogue-category-image-url"
                type="url"
                value={draft.image_url}
                placeholder="https://…"
                onChange={(event) => onChange({ image_url: event.target.value })}
              />
            </div>
          </div>
        </section>

        <aside className="lg:col-span-4 flex min-w-0 flex-col gap-y-4">
          <section className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-4 rounded-lg border p-5">
            <div className="flex items-center justify-between gap-3">
              <Heading level="h2">Configuración</Heading>
              <Badge color={statusColor(draft)}>{statusLabel(draft)}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="catalogue-category-coming-soon" className="text-sm font-medium">
                Próximamente
              </label>
              <Switch
                id="catalogue-category-coming-soon"
                aria-label="Próximamente"
                checked={draft.coming_soon}
                disabled={saving}
                onCheckedChange={(comingSoon) => onChange({ coming_soon: comingSoon })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="catalogue-category-active"
                  className={draft.coming_soon ? "text-ui-fg-muted text-sm font-medium" : "text-sm font-medium"}
                >
                  Activa
                </label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Publica tarjeta en Store.
                </Text>
              </div>
              <Switch
                id="catalogue-category-active"
                aria-label="Activa"
                checked={draft.active}
                disabled={draft.coming_soon || saving}
                onCheckedChange={(active) => onChange({ active })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="catalogue-category-interaction-locked"
                  className={draft.coming_soon ? "text-ui-fg-muted text-sm font-medium" : "text-sm font-medium"}
                >
                  Interacción bloqueada
                </label>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Evita navegación desde Store.
                </Text>
              </div>
              <Switch
                id="catalogue-category-interaction-locked"
                aria-label="Interacción bloqueada"
                checked={draft.coming_soon || draft.interaction_locked}
                disabled={draft.coming_soon || saving}
                onCheckedChange={(interaction_locked) => onChange({ interaction_locked })}
              />
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {draft.coming_soon
                ? "Regla aplicada: Próximamente deja la categoría inactiva y bloquea la interacción."
                : "Al marcar Próximamente, la categoría se guardará inactiva."}
            </Text>
          </section>

          <section className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-3 rounded-lg border p-5">
            <Heading level="h2">Acciones</Heading>
            {error && (
              <Text size="small" role="alert" className="text-ui-fg-error">
                {error}
              </Text>
            )}
            <Button type="submit" isLoading={saving} disabled={uploading}>
              Guardar cambios
            </Button>
            <Button type="button" variant="secondary" onClick={onBack} disabled={saving}>
              Cancelar
            </Button>
          </section>
        </aside>
      </form>
    </Container>
  </div>
)
