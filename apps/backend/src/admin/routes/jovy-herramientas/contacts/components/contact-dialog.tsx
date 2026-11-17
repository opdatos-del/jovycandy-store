import { XMark } from "@medusajs/icons"
import { Button } from "@medusajs/ui"
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"

type ContactDialogProps = {
  title: string
  titleId: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: "md" | "lg" | "xl"
  initialFocusRef?: RefObject<HTMLElement | null>
}

const WIDTHS: Record<NonNullable<ContactDialogProps["width"]>, string> = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
}

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), " +
  "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

/**
 * Diálogo modal accesible para detalle, edición y auditoría. Mantiene el foco
 * dentro del panel, cierra con Escape, bloquea el scroll del documento y
 * devuelve el foco al disparador. Se monta solo cuando hay contenido abierto,
 * así que el efecto de captura corre una vez por apertura.
 */
export function ContactDialog({
  title,
  titleId,
  description,
  onClose,
  children,
  footer,
  width = "lg",
  initialFocusRef,
}: ContactDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    ;(initialFocusRef?.current ?? closeRef.current)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // El Prompt de Medusa se monta por encima; su Escape no debe cerrar el detalle.
      if (document.querySelector('[role="alertdialog"]')) return
      event.preventDefault()
      onCloseRef.current()
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
    // Solo se ejecuta al montar/desmontar el diálogo; el cierre se lee del ref.
  }, [])

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
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

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      data-testid="contact-dialog-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? `${titleId}-description` : undefined}
        onKeyDown={trapFocus}
        className={`bg-ui-bg-base border-ui-border-base flex max-h-[92vh] w-full ${WIDTHS[width]} flex-col overflow-hidden rounded-t-2xl border shadow-xl sm:max-h-[88vh] sm:rounded-lg`}
      >
        <header className="border-ui-border-base flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-ui-fg-base text-base leading-snug font-semibold break-words sm:text-lg">
              {title}
            </h2>
            {description && (
              <p id={`${titleId}-description`} className="text-ui-fg-subtle mt-1 text-sm">
                {description}
              </p>
            )}
          </div>
          <Button
            ref={closeRef}
            type="button"
            size="small"
            variant="transparent"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <XMark />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>

        {footer && (
          <footer className="border-ui-border-base bg-ui-bg-base flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
