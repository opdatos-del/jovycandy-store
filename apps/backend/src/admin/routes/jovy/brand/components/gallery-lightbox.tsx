import { XMark } from "@medusajs/icons"
import { Button } from "@medusajs/ui"
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { createPortal } from "react-dom"

export type GalleryLightboxImage = {
  id: string
  src: string
  title: string
  description: string | null
}

type Props = {
  images: GalleryLightboxImage[]
  activeId: string | null
  onClose: () => void
  onSelect: (id: string) => void
}

/**
 * Visor ampliado accesible: cierra con Escape, navega con flechas, mantiene el
 * foco dentro del diálogo y lo devuelve al disparador al salir.
 */
export const GalleryLightbox = ({ images, activeId, onClose, onSelect }: Props) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const handlers = useRef({ images, activeId, onClose, onSelect })
  handlers.current = { images, activeId, onClose, onSelect }

  const index = images.findIndex((image) => image.id === activeId)
  const image = index >= 0 ? images[index] : null
  const open = image !== null

  const move = (direction: -1 | 1) => {
    const state = handlers.current
    if (state.images.length < 2) return
    const current = state.images.findIndex((entry) => entry.id === state.activeId)
    const next = (current + direction + state.images.length) % state.images.length
    state.onSelect(state.images[next].id)
  }

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        handlers.current.onClose()
      }
      if (event.key === "ArrowLeft") move(-1)
      if (event.key === "ArrowRight") move(1)
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previous?.isConnected) previous.focus()
    }
    // `open` cambia solo al abrir o cerrar; los handlers se leen desde el ref.
  }, [open])

  if (!image) return null

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    )
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

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-lightbox-title"
        className="flex max-h-full w-full max-w-5xl flex-col gap-3 rounded-lg bg-black/45 p-4 ring-1 ring-white/15"
        onKeyDown={onDialogKeyDown}
      >
        <div className="flex items-start justify-between gap-3 text-white">
          <div className="min-w-0">
            <h2 id="gallery-lightbox-title" className="truncate text-lg font-semibold">
              {image.title}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Imagen {index + 1} de {images.length}
              {image.description ? ` · ${image.description}` : ""}
            </p>
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="secondary"
            size="small"
            onClick={onClose}
            aria-label="Cerrar vista ampliada"
          >
            <XMark /> Cerrar
          </Button>
        </div>
        <div className="flex min-h-[40vh] min-w-0 flex-1 items-center justify-center rounded-md bg-black/30 p-2">
          <img
            src={image.src}
            alt={`Vista ampliada de ${image.title}`}
            className="max-h-[70vh] max-w-full rounded-md bg-white object-contain shadow-2xl"
            draggable={false}
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={() => move(-1)}
            disabled={images.length < 2}
            aria-label="Imagen anterior"
          >
            ← Anterior
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={() => move(1)}
            disabled={images.length < 2}
            aria-label="Imagen siguiente"
          >
            Siguiente →
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
