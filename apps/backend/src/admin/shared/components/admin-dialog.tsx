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

export type AdminDialogWidth = "md" | "lg" | "xl" | "2xl" | "5xl" | "6xl"

type AdminDialogProps = {
  title: string
  titleId: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: AdminDialogWidth
  initialFocusRef?: RefObject<HTMLElement | null>
  closeDisabled?: boolean
  /** Elemento junto al título, por ejemplo un Badge de estado. */
  titleAdornment?: ReactNode
  panelId?: string
  backdropTestId?: string
  panelTestId?: string
}

const WIDTHS: Record<AdminDialogWidth, string> = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  "2xl": "max-w-6xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
}

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), " +
  "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

// Los diálogos pueden apilarse (por ejemplo, un detalle sobre un modal). Solo
// el último montado debe consumir Escape; los demás esperan cerrados.
const dialogStack: symbol[] = []

function visibleFocusable(panel: HTMLElement | null): HTMLElement[] {
  const elements = panel?.querySelectorAll<HTMLElement>(FOCUSABLE)
  if (!elements) return []
  return [...elements].filter((element) => {
    const style = window.getComputedStyle(element)
    return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0
  })
}

/**
 * Diálogo modal accesible compartido por las features del Admin. Monta en un
 * portal, atrapa el foco, cierra con Escape, bloquea el scroll del documento y
 * restaura el foco al disparador. El Prompt de Medusa se superpone y conserva
 * su propio Escape.
 */
export function AdminDialog({
  title,
  titleId,
  description,
  onClose,
  children,
  footer,
  width = "lg",
  initialFocusRef,
  closeDisabled = false,
  titleAdornment,
  panelId,
  backdropTestId,
  panelTestId,
}: AdminDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogIdRef = useRef(Symbol("admin-dialog"))
  const onCloseRef = useRef(onClose)
  const closeDisabledRef = useRef(closeDisabled)
  onCloseRef.current = onClose
  closeDisabledRef.current = closeDisabled

  useEffect(() => {
    const dialogId = dialogIdRef.current
    dialogStack.push(dialogId)

    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const initial = initialFocusRef?.current ?? closeRef.current
    if (initial) initial.focus()
    else panelRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      // Solo el diálogo superior consume Escape; el Prompt de Medusa se monta
      // por encima y conserva su propio cierre.
      if (dialogStack[dialogStack.length - 1] !== dialogId) return
      if (document.querySelector('[role="alertdialog"]')) return
      if (closeDisabledRef.current) return
      event.preventDefault()
      onCloseRef.current()
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      const index = dialogStack.lastIndexOf(dialogId)
      if (index >= 0) dialogStack.splice(index, 1)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
    // Solo corre al montar/desmontar; el cierre se lee desde el ref.
  }, [initialFocusRef])

  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return
    const focusable = visibleFocusable(panelRef.current)
    if (!focusable.length) {
      event.preventDefault()
      panelRef.current?.focus()
      return
    }
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
      data-testid={backdropTestId}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || closeDisabledRef.current) return
        onClose()
      }}
    >
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={titleId}
        aria-describedby={description ? `${titleId}-description` : undefined}
        onKeyDown={trapFocus}
        data-jovy-quality
        data-testid={panelTestId}
        className={`bg-ui-bg-base border-ui-border-base flex max-h-[92vh] w-full ${WIDTHS[width]} flex-col overflow-hidden rounded-t-2xl border shadow-xl sm:max-h-[88vh] sm:rounded-lg`}
      >
        <header className="border-ui-border-base flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id={titleId}
                className="text-ui-fg-base text-base leading-snug font-semibold break-words sm:text-lg"
              >
                {title}
              </h2>
              {titleAdornment}
            </div>
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
            aria-label="Cerrar"
            disabled={closeDisabled}
            onClick={onClose}
            className="h-8 w-8 shrink-0 p-0"
          >
            <XMark className="shrink-0" />
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
