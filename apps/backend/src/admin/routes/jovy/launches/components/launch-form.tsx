import { Button, Container, Heading, Input, Switch, Text, Textarea } from "@medusajs/ui"
import { useState } from "react"
import type { Launch, LaunchDraft } from "./launch-types"
import { ProductPicker } from "./product-picker"

type UploadedImage = { id: string; url: string | null }

type Props = {
  editing: Launch | null
  initialProduct: { id: string; title: string; thumbnail?: string | null } | null
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (draft: LaunchDraft) => void
  onUpload: (file: File) => Promise<UploadedImage>
  searchProducts: (query: string) => Promise<Array<{ id: string; title: string; thumbnail?: string | null }>>
}

const labelClass = "text-ui-fg-subtle text-xs font-medium"
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

export const LaunchForm = ({
  editing,
  initialProduct,
  saving,
  error,
  onCancel,
  onSubmit,
  onUpload,
  searchProducts,
}: Props) => {
  const [draft, setDraft] = useState<LaunchDraft>(() => ({
    title: editing?.title ?? "",
    description: editing?.description ?? "",
    product: initialProduct,
    image_file_id: editing?.image_file_id ?? null,
    image_url: editing?.image_url ?? "",
    preview_url: editing?.image_resolved_url ?? null,
    active: editing?.active ?? true,
  }))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const update = (patch: Partial<LaunchDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const upload = async (file?: File) => {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type)) {
      setUploadError("Solo se aceptan imágenes PNG, JPEG o WebP.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("La imagen supera el límite de 5 MB.")
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const uploaded = await onUpload(file)
      update({ image_file_id: uploaded.id, preview_url: uploaded.url })
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : "No se pudo cargar la imagen.")
    } finally {
      setUploading(false)
    }
  }

  const submit = () => {
    if (draft.title.trim().length < 2) {
      setValidationError("El título debe tener al menos 2 caracteres.")
      return
    }
    if (!draft.product && !draft.image_file_id && !draft.image_url.trim()) {
      setValidationError("Asocia un producto de Medusa o carga una imagen para el lanzamiento.")
      return
    }
    if (draft.image_url.trim() && !draft.image_url.trim().startsWith("https://")) {
      setValidationError("La URL de imagen externa debe usar HTTPS.")
      return
    }
    setValidationError(null)
    onSubmit(draft)
  }

  const visibleError = validationError ?? error
  const previewUrl = (draft.preview_url ?? draft.image_url.trim()) || draft.product?.thumbnail || null

  return (
    <Container className="p-4 sm:p-6" data-testid="launch-form-panel">
      <div className="mb-6 flex flex-wrap items-start gap-3 border-b border-ui-border-base pb-4">
        <Button type="button" variant="transparent" size="small" onClick={onCancel} disabled={saving}>
          ← Volver a lanzamientos
        </Button>
        <div>
          <Heading level="h1">{editing ? "Editar lanzamiento" : "Nuevo lanzamiento"}</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Vincula un producto publicado o añade una imagen propia. PNG, JPEG y WebP: máximo 5 MB.
          </Text>
        </div>
      </div>

      <form
        id="launch-form"
        data-testid="launch-form"
        className="flex max-w-3xl flex-col gap-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >

      {visibleError && (
        <p role="alert" className="text-ui-fg-error text-sm">
          {visibleError}
        </p>
      )}

      <div className="flex flex-col gap-y-1">
        <label htmlFor="launch-title" className={labelClass}>
          Título
        </label>
        <Input
          id="launch-title"
          required
          minLength={2}
          maxLength={180}
          autoFocus
          value={draft.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </div>

      <div className="flex flex-col gap-y-1">
        <label htmlFor="launch-description" className={labelClass}>
          Descripción
        </label>
        <Textarea
          id="launch-description"
          maxLength={2000}
          value={draft.description}
          onChange={(event) => update({ description: event.target.value })}
        />
      </div>

      <ProductPicker
        selected={draft.product}
        onSelect={(product) => update({ product })}
        search={searchProducts}
      />

      <div className="flex flex-col gap-y-1">
        <label htmlFor="launch-image" className={labelClass}>
          Imagen propia (PNG, JPEG o WebP, máximo 5 MB)
        </label>
        <Input
          id="launch-image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        {uploading && (
          <Text size="xsmall" className="text-ui-fg-subtle" role="status">
            Subiendo imagen…
          </Text>
        )}
        {uploadError && (
          <Text size="small" role="alert" className="text-ui-fg-error">
            {uploadError}
          </Text>
        )}
        {previewUrl && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <img
              src={previewUrl}
              alt={`Vista previa de ${draft.title || "lanzamiento"}`}
              className="border-ui-border-base h-20 w-28 rounded object-cover"
            />
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() => update({ image_file_id: null, image_url: "", preview_url: null })}
            >
              Quitar imagen
            </Button>
          </div>
        )}
        <div className="mt-2 flex flex-col gap-y-1">
          <label htmlFor="launch-image-url" className={labelClass}>
            URL de imagen externa (opcional, HTTPS)
          </label>
          <Input
            id="launch-image-url"
            type="url"
            value={draft.image_url}
            placeholder="https://…"
            onChange={(event) => update({ image_url: event.target.value })}
          />
        </div>
      </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-ui-border-base px-3 py-3">
        <label htmlFor="launch-active" className="text-sm font-medium">
          Activo (visible en la portada)
        </label>
        <Switch
          id="launch-active"
          aria-label="Activo"
          checked={draft.active}
          onCheckedChange={(checked) => update({ active: checked })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={saving}>
          {editing ? "Guardar lanzamiento" : "Crear lanzamiento"}
        </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </form>
    </Container>
  )
}
