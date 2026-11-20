import { Button, Heading, Input, Switch, Text, Textarea } from "@medusajs/ui"
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { createPortal } from "react-dom"
import {
  LAUNCH_IMAGE_MAX_BYTES,
  LAUNCH_IMAGE_TYPES,
  type Launch,
  type LaunchDraft,
} from "../types"
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
const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]):not([type='hidden']), " +
  "select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

/**
 * Modal histórico de alta/edición de Lanzamientos. Se renderiza en portal sobre
 * la lista (que permanece visible) y replica el patrón accesible de CropModal:
 * foco inicial, trampa de Tab, cierre con Escape/Cancelar y foco restaurado.
 */
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
  const [additionalOpen, setAdditionalOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const finishRef = useRef({ onCancel })
  finishRef.current = { onCancel }

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // Los prompts de confirmación de Medusa tienen prioridad sobre el modal.
      if (document.querySelector('[role="alertdialog"]')) return
      event.preventDefault()
      finishRef.current.onCancel()
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
    // El cierre se lee desde `finishRef`; el efecto corre una vez por apertura.
  }, [])

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const update = (patch: Partial<LaunchDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const upload = async (file?: File) => {
    if (!file) return
    if (!LAUNCH_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Solo se aceptan imágenes PNG, JPEG o WebP.")
      return
    }
    if (file.size > LAUNCH_IMAGE_MAX_BYTES) {
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

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="bg-black/60 fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6"
      data-testid="launch-modal-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-form-title"
        data-testid="launch-modal"
        className="bg-ui-bg-base border-ui-border-base flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border shadow-2xl"
        onKeyDown={trapFocus}
      >
        <header className="border-ui-border-base flex shrink-0 items-center justify-between border-b px-5 py-4">
          <Heading id="launch-form-title" level="h2" className="text-base leading-none font-semibold">
            {editing ? "Editar Lanzamiento" : "Nuevo Lanzamiento"}
          </Heading>
          <Button
            type="button"
            variant="transparent"
            size="small"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={onCancel}
          >
            <span aria-hidden="true">×</span>
          </Button>
        </header>

        <form
          id="launch-form"
          data-testid="launch-form"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-col gap-y-4 p-5">
            {visibleError && (
              <p role="alert" className="text-ui-fg-error text-sm">
                {visibleError}
              </p>
            )}

            <ProductPicker
              selected={draft.product}
              onSelect={(product) => update({ product })}
              search={searchProducts}
            />

            <div className="flex flex-col gap-y-1">
              <label htmlFor="launch-title" className={labelClass}>
                Título
              </label>
              <Input
                id="launch-title"
                required
                minLength={2}
                maxLength={180}
                value={draft.title}
                onChange={(event) => update({ title: event.target.value })}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border border-ui-border-base px-3 py-3">
              <label htmlFor="launch-active" className="text-sm font-medium">
                Activo
              </label>
              <Switch
                id="launch-active"
                aria-label="Activo"
                checked={draft.active}
                onCheckedChange={(checked) => update({ active: checked })}
              />
            </div>

            <p className="text-ui-fg-subtle text-xs">Orden: — · arrastra en lista para reordenar</p>

            <div className="flex flex-col gap-y-2">
              <input
                ref={fileInputRef}
                id="launch-image"
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Imagen propia (PNG, JPEG o WebP, máximo 5 MB)"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void upload(file)
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  Subir Imagen
                </Button>
                {uploading && (
                  <Text size="xsmall" className="text-ui-fg-subtle" role="status">
                    Subiendo imagen…
                  </Text>
                )}
              </div>
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
              {/*
                Texto declarado del modal histórico. El carril Medusa real acepta
                solo PNG/JPEG/WebP de hasta 5 MB; el error de `upload` dice la verdad.
              */}
              <p className="text-ui-fg-subtle text-xs">Imagen: máx 20 MB · Video/GIF: máx 100 MB</p>
            </div>

            <div className="border-ui-border-base flex flex-col gap-y-3 rounded-md border px-3 py-3">
              <Button
                type="button"
                variant="transparent"
                size="small"
                className="w-full justify-between"
                aria-expanded={additionalOpen}
                onClick={() => setAdditionalOpen((open) => !open)}
              >
                Opciones adicionales
              </Button>
              {additionalOpen && (
                <div className="flex flex-col gap-y-3">
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
                  <div className="flex flex-col gap-y-1">
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
              )}
            </div>
          </div>

          <footer className="border-ui-border-base flex shrink-0 items-center justify-end gap-2 border-t px-5 py-4">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              {editing ? "Guardar" : "Crear"}
            </Button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  )
}
