import { Button, Container, Heading, Input, Text, Textarea } from "@medusajs/ui"
import type { FormEvent, RefObject } from "react"
import { GALLERY_ACCEPT } from "../api"
import { fromDateTimeLocal, toDateTimeLocal } from "../model"
import type { GalleryDraft, GalleryStatus } from "../types"

type Props = {
  form: GalleryDraft
  previewUrl: string | null
  uploading: boolean
  saving: boolean
  formError: string | null
  notice: string | null
  headingRef: RefObject<HTMLDivElement>
  onChange: (patch: Partial<GalleryDraft>) => void
  onUpload: (file?: File) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}

/**
 * Formulario de edición de un elemento de galería. Mantiene el orden de campos,
 * las etiquetas y el foco del encabezado que ya usaba la pantalla original.
 */
export const GalleryForm = ({
  form,
  previewUrl,
  uploading,
  saving,
  formError,
  notice,
  headingRef,
  onChange,
  onUpload,
  onSubmit,
  onCancel,
}: Props) => {
  return <Container className="p-6" data-testid="gallery-form-panel">
    <div className="border-ui-border-base mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div ref={headingRef} tabIndex={-1}>
        <Button type="button" variant="transparent" size="small" onClick={onCancel}>
          ← Volver a la galería
        </Button>
        <Heading level="h2">Editar elemento</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          El ciclo de vida y la ventana de publicación se editan en este formulario; la lista solo
          cambia el orden y el estado rápido.
        </Text>
      </div>
    </div>

    {formError && <p role="alert" className="text-ui-fg-error mb-4">{formError}</p>}
    {notice && <p role="status" className="text-ui-fg-success mb-4">{notice}</p>}

    <form className="grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]" onSubmit={onSubmit}>
      <section className="border-ui-border-base flex flex-col gap-4 rounded-md border p-4">
        <Heading level="h3">Contenido</Heading>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Título
          <Input
            aria-label="Título galería"
            maxLength={180}
            value={form.title ?? ""}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Descripción
          <Textarea
            aria-label="Descripción galería"
            maxLength={2000}
            value={form.description ?? ""}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </label>
        <div>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Imagen de galería
            <Input
              type="file"
              accept={GALLERY_ACCEPT}
              aria-label="Imagen de galería"
              disabled={uploading}
              onChange={(event) => {
                onUpload(event.target.files?.[0])
                event.target.value = ""
              }}
            />
          </label>
          <p className="text-ui-fg-subtle mt-1 text-xs">PNG, JPEG o WebP · máximo 5 MB.</p>
          {uploading && <p role="status" className="text-ui-fg-subtle mt-1 text-sm">Cargando imagen…</p>}
          {previewUrl && <img
            src={previewUrl}
            alt="Vista previa de galería"
            className="jovy-media border-ui-border-base mt-3 h-40 w-full max-w-xs rounded-md border object-cover"
          />}
        </div>
      </section>

      <section className="border-ui-border-base flex flex-col gap-4 rounded-md border p-4">
        <Heading level="h3">Publicación y ventana</Heading>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Estado
          <select
            aria-label="Estado galería"
            className="border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            value={form.status}
            onChange={(event) => onChange({ status: event.target.value as GalleryStatus })}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
          />
          Activo en Store
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Orden
          <Input
            type="number"
            min="0"
            aria-label="Orden galería"
            value={form.sort_order}
            onChange={(event) => onChange({ sort_order: Number(event.target.value) })}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Inicio de ventana
            <Input
              type="datetime-local"
              aria-label="Inicio galería"
              value={toDateTimeLocal(form.starts_at)}
              onChange={(event) => onChange({ starts_at: fromDateTimeLocal(event.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Fin de ventana
            <Input
              type="datetime-local"
              aria-label="Fin galería"
              value={toDateTimeLocal(form.ends_at)}
              onChange={(event) => onChange({ ends_at: fromDateTimeLocal(event.target.value) })}
            />
          </label>
        </div>
        <p className="text-ui-fg-subtle text-xs">
          Las fechas se escriben en tu hora local y se guardan en UTC. Sin ventana, el elemento
          queda visible mientras esté publicado y activo.
        </p>
      </section>

      <div className="flex flex-wrap gap-2 lg:col-span-2">
        <Button type="submit" isLoading={saving} disabled={uploading}>
          Guardar cambios
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  </Container>
}
