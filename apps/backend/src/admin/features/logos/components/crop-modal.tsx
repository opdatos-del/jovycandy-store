import { ArrowUturnLeft, ChevronRight, Eye, EyeSlash, Hashtag, InformationCircle } from "@medusajs/icons"
import { Button, Heading } from "@medusajs/ui"
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { createPortal } from "react-dom"
import { cropForPreview, clampCrop } from "@admin/features/logos/lib/crop"
import {
  CROP_FOCUSABLE,
  CROP_MAX_ZOOM,
  CROP_MIN_ZOOM,
  CROP_ZOOM_STEP,
  DEFAULT_CROP,
  type Crop,
} from "@admin/features/logos/types"

/**
 * Modal de recorte accesible, equivalente al panel histórico de Logos. Edita un
 * borrador local: «Aplicar y guardar» confirma en el formulario y «Cancelar»
 * descarta, de modo que el recurso original nunca se transforma.
 */
export function CropModal({ previewUrl, alt, crop, onApply, onClose }: {
  previewUrl: string | null
  alt: string
  crop: Crop
  onApply: (crop: Crop) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Crop>({ ...crop })
  const [gridVisible, setGridVisible] = useState(true)
  const [showOriginal, setShowOriginal] = useState(false)
  const [helpOpen, setHelpOpen] = useState(true)
  const [historyCount, setHistoryCount] = useState(0)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const historyRef = useRef<Crop[]>([])
  const coalesceRef = useRef<string | null>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; crop: Crop } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const finishRef = useRef({ onApply, onClose })
  finishRef.current = { onApply, onClose }

  const commit = (next: Crop, gesture?: string) => {
    if (!gesture || coalesceRef.current !== gesture) {
      historyRef.current = [...historyRef.current, draftRef.current].slice(-30)
      setHistoryCount(historyRef.current.length)
      coalesceRef.current = gesture ?? null
    }
    const normalized = clampCrop(next)
    draftRef.current = normalized
    setDraft(normalized)
  }
  const endGesture = () => { coalesceRef.current = null }
  const undo = () => {
    const stack = historyRef.current
    if (stack.length === 0) return
    const previous = stack[stack.length - 1]
    historyRef.current = stack.slice(0, -1)
    setHistoryCount(historyRef.current.length)
    coalesceRef.current = null
    draftRef.current = previous
    setDraft(previous)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // React registra `wheel` como pasivo; este listener evita el scroll de la página.
    const preventScroll = (event: WheelEvent) => event.preventDefault()
    canvas.addEventListener("wheel", preventScroll, { passive: false })
    return () => canvas.removeEventListener("wheel", preventScroll)
  }, [])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    canvasRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (document.querySelector('[role="alertdialog"]')) return
      event.preventDefault()
      finishRef.current.onClose()
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
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(CROP_FOCUSABLE)
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

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewUrl || event.button !== 0) return
    endGesture()
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, crop: draftRef.current }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRef.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    commit({
      ...activeDrag.crop,
      offset_x: activeDrag.crop.offset_x + ((event.clientX - activeDrag.x) / bounds.width) * 100,
      offset_y: activeDrag.crop.offset_y + ((event.clientY - activeDrag.y) / bounds.height) * 100,
    }, `drag-${event.pointerId}`)
  }
  const stopDragging = () => { dragRef.current = null; endGesture() }

  const onCanvasKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2],
    }
    const delta = nudges[event.key]
    if (!delta || !previewUrl) return
    event.preventDefault()
    commit({ ...draftRef.current, offset_x: draftRef.current.offset_x + delta[0], offset_y: draftRef.current.offset_y + delta[1] })
    endGesture()
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      className="bg-black/60 fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6"
      data-testid="logo-crop-modal-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logo-crop-modal-title"
        data-testid="logo-crop-modal"
        className="bg-ui-bg-base border-ui-border-base flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border shadow-2xl"
        onKeyDown={trapFocus}
      >
        <header className="border-ui-border-base flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Heading id="logo-crop-modal-title" level="h2" className="text-base leading-none font-semibold">Ajustar imagen</Heading>
            <InformationCircle className="text-ui-fg-subtle" aria-hidden="true" />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
            <div
              ref={canvasRef}
              tabIndex={0}
              aria-label="Lienzo de recorte de logo"
              data-testid="logo-crop-canvas"
              className="border-ui-border-base bg-ui-bg-subtle relative aspect-[16/8] w-full touch-none overflow-hidden rounded-md border"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              onKeyDown={onCanvasKeyDown}
              onWheel={(event: ReactWheelEvent<HTMLDivElement>) => {
                if (!previewUrl) return
                commit({ ...draftRef.current, zoom: draftRef.current.zoom + (event.deltaY < 0 ? CROP_ZOOM_STEP : -CROP_ZOOM_STEP) })
                endGesture()
              }}
              onDoubleClick={() => {
                if (!previewUrl) return
                commit({ ...draftRef.current, zoom: 1 })
                endGesture()
              }}
              style={{ cursor: previewUrl ? "grab" : "default" }}
            >
              {previewUrl
                ? <img
                    src={previewUrl}
                    alt={alt || "Vista previa de recorte de logo"}
                    className="absolute inset-0 h-full w-full object-contain"
                    style={showOriginal ? undefined : cropForPreview(draft)}
                    draggable={false}
                  />
                : <p className="text-ui-fg-subtle flex h-full items-center justify-center px-4 text-center text-sm">Carga un PNG, JPEG, WebP o GIF para ajustar encuadre.</p>}
              {gridVisible && previewUrl && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,.65) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.65) 1px, transparent 1px)", backgroundSize: "33.333% 33.333%" }} />}
              {previewUrl && !showOriginal && <div aria-hidden="true" className="border-ui-border-base pointer-events-none absolute inset-[16%] rounded-sm border" />}
            </div>
            <p className="text-ui-fg-subtle text-center text-xs">Vista previa del recorte</p>

            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                <span className="flex items-center gap-2">Zoom <span className="text-ui-fg-subtle text-xs font-normal">Recomendado: 75%</span></span>
                <span className="flex items-center gap-2">
                  <span data-testid="logo-crop-zoom-percent" className="text-ui-fg-interactive text-sm font-semibold">{Math.round(draft.zoom * 100)}%</span>
                  <span data-testid="logo-crop-zoom-value" className="text-ui-fg-subtle text-xs">{draft.zoom.toFixed(2)}×</span>
                </span>
              </div>
              <input
                type="range"
                min={CROP_MIN_ZOOM}
                max={CROP_MAX_ZOOM}
                step={CROP_ZOOM_STEP}
                value={draft.zoom}
                aria-label="Zoom del recorte"
                data-testid="logo-crop-zoom-slider"
                className="w-full"
                disabled={!previewUrl}
                onPointerDown={endGesture}
                onPointerUp={endGesture}
                onKeyDown={endGesture}
                onKeyUp={endGesture}
                onChange={(event) => commit({ ...draftRef.current, zoom: Number(event.target.value) }, "zoom-slider")}
              />
              <div className="text-ui-fg-subtle flex justify-between text-xs"><span>0.5×</span><span>1×</span><span>1.5×</span><span>2×</span></div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="small" aria-label="Ver imagen original" aria-pressed={showOriginal} title="Ver imagen original" data-testid="logo-crop-original-toggle" disabled={!previewUrl} onClick={() => setShowOriginal((value) => !value)}>
                {showOriginal ? <EyeSlash /> : <Eye />}
              </Button>
              <Button type="button" variant="secondary" size="small" aria-label="Cuadrícula de tercios" aria-pressed={gridVisible} title="Cuadrícula de tercios" data-testid="logo-crop-grid-toggle" disabled={!previewUrl} onClick={() => setGridVisible((value) => !value)}>
                <Hashtag />
              </Button>
              <Button type="button" variant="secondary" size="small" aria-label="Deshacer último ajuste" title="Deshacer último ajuste" data-testid="logo-crop-undo" disabled={historyCount === 0} onClick={undo}>
                <ArrowUturnLeft />
              </Button>
              <p className="text-ui-fg-subtle text-xs">Arrastra la imagen para mover · rueda para zoom · doble clic = 100%</p>
              <span data-testid="logo-crop-offset" className="text-ui-fg-subtle text-xs">x: {draft.offset_x}% · y: {draft.offset_y}%</span>
            </div>

            <footer className="border-ui-border-base mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <Button type="button" variant="transparent" data-testid="logo-crop-cancel" onClick={onClose}>Cancelar</Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" data-testid="logo-crop-reset" disabled={!previewUrl} onClick={() => { commit({ ...DEFAULT_CROP }); endGesture() }}>Volver a img original</Button>
                <Button type="button" variant="primary" data-testid="logo-crop-apply" disabled={!previewUrl} onClick={() => finishRef.current.onApply({ ...draftRef.current })}>Aplicar y guardar</Button>
              </div>
            </footer>
          </div>

          <aside className="border-ui-border-base w-full shrink-0 border-t p-4 lg:w-72 lg:border-t-0 lg:border-l">
            <Button
              type="button"
              variant="transparent"
              size="small"
              aria-expanded={helpOpen}
              data-testid="logo-crop-help-toggle"
              className="w-full justify-between"
              onClick={() => setHelpOpen((value) => !value)}
            >
              <span className="flex items-center gap-2"><InformationCircle /> Ayuda</span>
              <ChevronRight className={helpOpen ? "rotate-90" : ""} />
            </Button>
            {helpOpen && <div data-testid="logo-crop-help-panel" className="mt-3 flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">Vista previa</p>
                <p className="text-ui-fg-subtle text-xs">Muestra exactamente cómo se verá el logo en el carrusel web.</p>
              </div>
              <div>
                <p className="text-sm font-medium">Zoom</p>
                <p className="text-ui-fg-subtle text-xs">1.0× original · &lt;1.0× letterbox · &gt;1.0× recorte. 50% equivale a 0.5×.</p>
              </div>
              <div>
                <p className="text-sm font-medium">Consejos</p>
                <p className="text-ui-fg-subtle text-xs">Usa 0.8×–1.2×. Evita recortes &gt;1.5× y prefiere PNG/SVG transparente.</p>
                <p className="text-ui-fg-subtle text-xs">En Medusa, SVG no está disponible por seguridad: usa PNG transparente.</p>
              </div>
              <div>
                <p className="text-sm font-medium">Botones</p>
                <p className="text-ui-fg-subtle text-xs">Volver a img original restaura zoom 1.0× (tamaño original sin recorte).</p>
              </div>
            </div>}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  )
}
