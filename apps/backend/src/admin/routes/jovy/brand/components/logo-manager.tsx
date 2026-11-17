import { ArrowUturnLeft, ChevronRight, Eye, EyeSlash, Hashtag, InformationCircle } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Textarea, usePrompt } from "@medusajs/ui"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"
import { createPortal } from "react-dom"

type Crop = { zoom: number; offset_x: number; offset_y: number }
type FamilyLabel = { id: string; slug: string; name: string }
type Logo = {
  id: string
  slug: string
  name: string
  alt: string | null
  families: string[] | null
  families_linked: boolean
  family_ids: string[]
  family_labels: FamilyLabel[]
  unmapped_families: string[]
  media_file_id: string
  media_url: string | null
  crop: Crop | null
  enabled: boolean
  sort_order: number
}
type Family = { id: string; slug: string; name: string; active: boolean; medusa_category_id: string | null }
type CatalogueCategory = { key: string; name: string; medusa_category_id: string | null }
type LogoForm = {
  slug: string
  name: string
  alt: string | null
  family_ids: string[]
  media_file_id: string
  crop: Crop
  enabled: boolean
  sort_order: number
}

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const DEFAULT_CROP: Crop = { zoom: 1, offset_x: 0, offset_y: 0 }
const CROP_MIN_ZOOM = 0.5
const CROP_MAX_ZOOM = 2
const CROP_ZOOM_STEP = 0.05
const CROP_FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), " +
  "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

type LogoStatusFilter = "all" | "active" | "inactive"

const emptyLogo = (): LogoForm => ({
  slug: "",
  name: "",
  alt: "",
  family_ids: [],
  media_file_id: "",
  crop: DEFAULT_CROP,
  enabled: true,
  sort_order: 0,
})

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { ...init?.headers, ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }) },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Operación no disponible" })) as { message?: string }
    throw new Error(body.message || "Operación no disponible")
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

function cropForPreview(crop: Crop): Pick<CSSStyleDeclaration, "transform"> {
  return { transform: `translate(${crop.offset_x}%, ${crop.offset_y}%) scale(${crop.zoom})` }
}

const clampZoom = (value: number) => Math.max(CROP_MIN_ZOOM, Math.min(CROP_MAX_ZOOM, Math.round(value * 100) / 100))
const clampOffset = (value: number) => Math.max(-80, Math.min(80, Math.round(value)))
const clampCrop = (crop: Crop): Crop => ({
  zoom: clampZoom(crop.zoom),
  offset_x: clampOffset(crop.offset_x),
  offset_y: clampOffset(crop.offset_y),
})

/**
 * Modal de recorte accesible, equivalente al panel histórico de Logos. Edita un
 * borrador local: «Aplicar y guardar» confirma en el formulario y «Cancelar»
 * descarta, de modo que el recurso original nunca se transforma.
 */
function CropModal({ previewUrl, alt, crop, onApply, onClose }: {
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

function LogoCard({ logo, index, total, isBusy, isReordering, onEdit, onDelete, onToggle, onMove }: {
  logo: Logo
  index: number
  total: number
  isBusy: boolean
  isReordering: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onMove: (direction: -1 | 1) => void
}) {
  return <article className="flex min-w-0 flex-col rounded-md border border-ui-border-base bg-ui-bg-base p-3 shadow-elevation-card-rest">
    <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded bg-ui-bg-subtle">
      {logo.media_url ? <img src={logo.media_url} alt={logo.alt || logo.name} className="h-full w-full object-contain" loading="lazy" style={cropForPreview(logo.crop || DEFAULT_CROP)} /> : <span className="flex h-full items-center justify-center text-ui-fg-muted text-xs">Sin recurso</span>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-y-2">
      <div className="min-w-0"><h3 className="truncate font-medium">{logo.name}</h3><p className="line-clamp-2 text-ui-fg-subtle text-xs">{logo.family_labels.map((family) => family.name).join(", ") || "Sin familias canónicas"}</p></div>
      {logo.unmapped_families.length > 0 && <p className="rounded bg-ui-bg-component px-2 py-1 text-ui-fg-subtle text-xs">Legado sin equivalente: {logo.unmapped_families.join(", ")}</p>}
      <div className="flex flex-wrap gap-1"><Badge color={logo.enabled ? "green" : "grey"}>{logo.enabled ? "Activo" : "Inactivo"}</Badge><Badge color="blue">Orden global {index + 1}</Badge></div>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-ui-border-base pt-3">
        <Button size="small" variant="secondary" onClick={onEdit} disabled={isBusy || isReordering}>Editar</Button>
        <Button size="small" variant="secondary" onClick={onToggle} isLoading={isBusy}>{logo.enabled ? "Desactivar" : "Activar"}</Button>
        <Button size="small" variant="secondary" aria-label={`Subir ${logo.name}`} onClick={() => onMove(-1)} disabled={isBusy || isReordering || index === 0}>Subir</Button>
        <Button size="small" variant="secondary" aria-label={`Bajar ${logo.name}`} onClick={() => onMove(1)} disabled={isBusy || isReordering || index === total - 1}>Bajar</Button>
        <Button size="small" variant="danger" onClick={onDelete} disabled={isBusy || isReordering}>Eliminar</Button>
      </div>
    </div>
  </article>
}

export function BrandLogoManager() {
  const prompt = usePrompt()
  const formTitle = useRef<HTMLDivElement>(null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const [logos, setLogos] = useState<Logo[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [familyDirectory, setFamilyDirectory] = useState<Family[]>([])
  const [categories, setCategories] = useState<CatalogueCategory[]>([])
  const [familyCategory, setFamilyCategory] = useState("")
  const [form, setForm] = useState<LogoForm>(emptyLogo())
  const [editing, setEditing] = useState<string | null>(null)
  const [legacyFamilies, setLegacyFamilies] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingLogoId, setPendingLogoId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<LogoStatusFilter>("all")

  const load = async () => {
    setLoading(true)
    try {
      const [logoResponse, familyResponse, categoryResponse] = await Promise.all([
        api<{ logos: Logo[] }>("/admin/jovy/brand/logos"),
        api<{ families: Family[] }>("/admin/jovy/catalogue/families"),
        api<{ categories: CatalogueCategory[] }>("/admin/jovy/catalogue/categories"),
      ])
      setLogos(logoResponse.logos)
      setFamilies(familyResponse.families)
      setFamilyDirectory(familyResponse.families)
      setCategories(categoryResponse.categories)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los logos.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { if (editing !== null) formTitle.current?.focus() }, [editing])

  const resetForm = () => {
    setEditing(null)
    setForm(emptyLogo())
    setLegacyFamilies([])
    setPreviewUrl(null)
    setCropModalOpen(false)
    setFamilyCategory("")
    setError(null)
  }
  const openCreate = () => {
    resetForm()
    setEditing("new")
  }
  const openEdit = (logo: Logo) => {
    setEditing(logo.id)
    setForm({
      slug: logo.slug,
      name: logo.name,
      alt: logo.alt || "",
      family_ids: logo.family_ids,
      media_file_id: logo.media_file_id,
      crop: logo.crop || DEFAULT_CROP,
      enabled: logo.enabled,
      sort_order: logo.sort_order,
    })
    setLegacyFamilies(logo.unmapped_families ?? [])
    setPreviewUrl(logo.media_url)
    setError(null)
  }
  const selectCategory = async (categoryKey: string) => {
    setFamilyCategory(categoryKey)
    try {
      const response = await api<{ families: Family[] }>(categoryKey
        ? `/admin/jovy/catalogue/families?category_key=${encodeURIComponent(categoryKey)}`
        : "/admin/jovy/catalogue/families")
      setFamilies(response.families)
      setError(null)
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "No se pudieron cargar las familias de esta categoría.")
    }
  }
  const toggleFamily = (familyId: string) => setForm((current) => ({
    ...current,
    family_ids: current.family_ids.includes(familyId)
      ? current.family_ids.filter((id) => id !== familyId)
      : [...current.family_ids, familyId],
  }))
  const upload = async (file?: File) => {
    if (!file) return
    setNotice(null)
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("El recurso debe ser PNG, JPEG, WebP o GIF. No se admiten SVG.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("El recurso excede 20 MB. Selecciona una imagen PNG, JPEG, WebP o GIF de máximo 20 MB.")
      return
    }
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append("files", file)
      const result = await api<{ file: { id: string; url?: string } }>("/admin/jovy/brand/logos/media", { method: "POST", body })
      setForm((current) => ({ ...current, media_file_id: result.file.id }))
      setPreviewUrl(result.file.url || URL.createObjectURL(file))
      setNotice("Recurso cargado. Guarda el formulario para asociarlo al logo.")
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo cargar el recurso.")
    } finally {
      setUploading(false)
    }
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || uploading) return
    if (!form.media_file_id) {
      setError("Selecciona un recurso válido antes de guardar.")
      return
    }
    const isCreate = editing === "new"
    const confirmed = await prompt({
      title: isCreate ? "Crear logo" : "Guardar cambios del logo",
      description: isCreate
        ? `Crearás “${form.name || "este logo"}” con el recurso, recorte y familias seleccionados.`
        : `Guardarás los cambios de “${form.name || "este logo"}”, incluido recurso, recorte y familias seleccionados.`,
      variant: "confirmation",
      confirmText: isCreate ? "Crear logo" : "Guardar cambios",
      cancelText: "Seguir editando",
    })
    if (!confirmed) {
      requestAnimationFrame(() => saveButton.current?.focus())
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api(!isCreate && editing ? `/admin/jovy/brand/logos/${editing}` : "/admin/jovy/brand/logos", {
        method: isCreate ? "POST" : "PUT",
        body: JSON.stringify({ ...form, family_ids: form.family_ids }),
      })
      setNotice("Logo guardado.")
      resetForm()
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el logo.")
    } finally {
      setSaving(false)
    }
  }
  const toggle = async (logo: Logo) => {
    const enabled = !logo.enabled
    const confirmed = await prompt({
      title: enabled ? "Activar logo" : "Desactivar logo",
      description: enabled
        ? `“${logo.name}” volverá a estar disponible en Store.`
        : `“${logo.name}” dejará de estar disponible en Store.`,
      variant: "confirmation",
      confirmText: enabled ? "Activar logo" : "Desactivar logo",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    setPendingLogoId(logo.id)
    setError(null)
    try {
      await api(`/admin/jovy/brand/logos/${logo.id}`, { method: "PUT", body: JSON.stringify({ enabled }) })
      setNotice(enabled ? "Logo activado." : "Logo desactivado.")
      await load()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "No se pudo actualizar el logo.")
    } finally {
      setPendingLogoId(null)
    }
  }
  const remove = async (logo: Logo) => {
    const confirmed = await prompt({
      title: "Eliminar logo",
      description: `Eliminarás “${logo.name}”. El archivo compartido no se eliminará.`,
      confirmText: "Eliminar logo",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    setPendingLogoId(logo.id)
    setError(null)
    try {
      await api(`/admin/jovy/brand/logos/${logo.id}`, { method: "DELETE" })
      setNotice("Logo eliminado.")
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "No se pudo eliminar el logo.")
    } finally {
      setPendingLogoId(null)
    }
  }
  const move = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= logos.length) return
    const logo = logos[index]
    const directionLabel = direction === -1 ? "arriba" : "abajo"
    const confirmed = await prompt({
      title: "Cambiar orden de logo",
      description: `Moverás “${logo.name}” una posición hacia ${directionLabel} en el orden global.`,
      variant: "confirmation",
      confirmText: "Cambiar orden",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    const ids = logos.map((logo) => logo.id)
    ;[ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]]
    setReordering(true)
    setError(null)
    try {
      await api("/admin/jovy/brand/logos/reorder", { method: "POST", body: JSON.stringify({ ids }) })
      setNotice("Orden de logos actualizado.")
      await load()
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "No se pudo reordenar el logo.")
    } finally {
      setReordering(false)
    }
  }

  const selectableFamilies = useMemo(() => [
    ...families,
    ...familyDirectory.filter((family) => form.family_ids.includes(family.id) && !families.some((item) => item.id === family.id)),
  ], [families, familyDirectory, form.family_ids])
  const familyName = (id: string) => familyDirectory.find((family) => family.id === id)?.name ?? id
  const isFormOpen = editing !== null

  /**
   * Filtros locales sobre las filas ya cargadas: no consultan otro endpoint ni
   * cambian el orden global. La categoría de cada logo se deriva de sus familias
   * canónicas y del vínculo de la tarjeta de catálogo con Medusa.
   */
  const categoryKeyByMedusaId = useMemo(
    () => new Map(
      categories
        .filter((category): category is CatalogueCategory & { medusa_category_id: string } =>
          Boolean(category.medusa_category_id))
        .map((category) => [category.medusa_category_id, category.key] as const),
    ),
    [categories],
  )
  const categoryKeyByFamilyId = useMemo(
    () => new Map(familyDirectory.map((family) => [
      family.id,
      family.medusa_category_id ? categoryKeyByMedusaId.get(family.medusa_category_id) ?? null : null,
    ] as const)),
    [categoryKeyByMedusaId, familyDirectory],
  )
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ key: category.key, name: category.name })),
    [categories],
  )
  const searchTerm = search.trim().toLowerCase()
  const filteredLogos = useMemo(() => logos.filter((logo) => {
    if (statusFilter === "active" && !logo.enabled) return false
    if (statusFilter === "inactive" && logo.enabled) return false
    if (categoryFilter && !logo.family_labels.some((family) => categoryKeyByFamilyId.get(family.id) === categoryFilter)) {
      return false
    }
    if (!searchTerm) return true
    return (
      logo.name.toLowerCase().includes(searchTerm)
      || logo.slug.toLowerCase().includes(searchTerm)
      || logo.family_ids.some((id) => id.toLowerCase().includes(searchTerm))
      || logo.family_labels.some((family) => (
        family.name.toLowerCase().includes(searchTerm) || family.slug.toLowerCase().includes(searchTerm)
      ))
    )
  }), [logos, statusFilter, categoryFilter, categoryKeyByFamilyId, searchTerm])
  const activeLogoCount = logos.filter((logo) => logo.enabled).length
  const filtersActive = searchTerm.length > 0 || categoryFilter.length > 0 || statusFilter !== "all"
  const clearFilters = () => {
    setSearch("")
    setCategoryFilter("")
    setStatusFilter("all")
  }

  if (isFormOpen) return <>
    <Container className="p-6" data-testid="jovy-logo-form-panel">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ui-border-base pb-4">
      <div ref={formTitle} tabIndex={-1}><Button type="button" variant="transparent" size="small" onClick={resetForm}>← Volver a logos</Button><Heading level="h2">{editing === "new" ? "Nuevo logo" : "Editar logo"}</Heading><p className="text-ui-fg-subtle text-sm">Recurso, familias y encuadre se editan en este panel separado.</p></div>
    </div>
    {error && <p role="alert" className="mb-4 text-ui-fg-error">{error}</p>}
    {notice && <p role="status" className="mb-4 text-ui-fg-success">{notice}</p>}
    <form id="jovy-logo-form" className="grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,.85fr)]" onSubmit={save}>
      <div className="flex flex-col gap-5">
        <section className="rounded-md border border-ui-border-base p-4"><Heading level="h3">Información y recurso</Heading><div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm font-medium">Slug <Input required aria-label="Slug logo" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="marca-corporativa" /></label><label className="flex flex-col gap-1 text-sm font-medium">Nombre <Input required aria-label="Nombre logo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label></div>
          <label className="flex flex-col gap-1 text-sm font-medium">Texto alternativo <Textarea aria-label="Texto alternativo logo" value={form.alt || ""} onChange={(event) => setForm({ ...form, alt: event.target.value || null })} /></label>
          <div><label className="flex flex-col gap-1 text-sm font-medium">Recurso del logo <Input aria-label="Archivo de logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void upload(event.target.files?.[0])} disabled={uploading} /></label><p className="mt-1 text-ui-fg-subtle text-xs">PNG, JPEG, WebP o GIF · máximo 20 MB.</p>{uploading && <p role="status" className="mt-1 text-ui-fg-subtle text-sm">Cargando recurso…</p>}</div>
        </div></section>
        <section className="rounded-md border border-ui-border-base p-4">
          <Heading level="h3">Ajuste visual</Heading>
          <p className="text-ui-fg-subtle mt-1 text-sm">El encuadre se guarda como recorte; el archivo original no se modifica.</p>
          <div className="border-ui-border-base bg-ui-bg-subtle relative mt-3 aspect-[16/8] w-full overflow-hidden rounded-md border">
            {previewUrl
              ? <img src={previewUrl} alt={form.alt || form.name} className="absolute inset-0 h-full w-full object-contain" style={cropForPreview(form.crop)} />
              : <p className="text-ui-fg-subtle flex h-full items-center justify-center px-4 text-center text-sm">Carga un recurso para ajustar encuadre.</p>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-ui-fg-subtle text-xs" data-testid="logo-crop-summary">zoom {form.crop.zoom.toFixed(2)}× · x: {form.crop.offset_x}% · y: {form.crop.offset_y}%</p>
            <Button type="button" variant="secondary" data-testid="logo-crop-open" onClick={() => setCropModalOpen(true)}>Ajustar imagen</Button>
          </div>
        </section>
      </div>
      <div className="flex flex-col gap-5">
        <section className="rounded-md border border-ui-border-base p-4"><Heading level="h3">Catálogo y publicación</Heading><div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">Categoría del catálogo<select aria-label="Categoría de familias" className="h-9 rounded-md border border-ui-border-base bg-ui-bg-field px-3" value={familyCategory} onChange={(event) => void selectCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.key} value={category.key}>{category.name}</option>)}</select></label>
          {categories.length === 0 && <p className="text-ui-fg-subtle text-sm">El catálogo aún no tiene categorías; las familias se listan sin filtro.</p>}
          {familyCategory && selectableFamilies.length === 0 && <p className="text-ui-fg-subtle text-sm">La categoría seleccionada no tiene familias vinculadas.</p>}
          <fieldset className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border border-ui-border-base p-3"><legend className="px-1 text-sm font-medium">Familias canónicas</legend>{selectableFamilies.length === 0 ? <p className="text-ui-fg-subtle text-sm">No hay familias disponibles.</p> : selectableFamilies.map((family) => <label key={family.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.family_ids.includes(family.id)} onChange={() => toggleFamily(family.id)} aria-label={`Familia ${family.name}`} /><span>{family.name}</span>{!family.active && <Badge color="grey">inactiva</Badge>}{!families.some((item) => item.id === family.id) && <Badge color="orange">fuera de categoría</Badge>}</label>)}</fieldset>
          {form.family_ids.length > 0 && <p className="text-ui-fg-subtle text-sm">Seleccionadas: {form.family_ids.map(familyName).join(", ")}</p>}
          {legacyFamilies.length > 0 && <p role="status" className="rounded bg-ui-bg-component p-3 text-ui-fg-subtle text-sm">Relaciones de legado sin equivalente: {legacyFamilies.join(", ")}. Se muestran como referencia, no se envían; el contrato canónico es <code>family_ids</code>.</p>}
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Activo en Store</label>
        </div></section>
        <div className="flex flex-wrap gap-2"><Button type="submit" isLoading={saving} disabled={uploading}>{editing === "new" ? "Crear logo" : "Guardar cambios"}</Button><Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button></div>
      </div>
    </form>
    </Container>
    {cropModalOpen && <CropModal
      previewUrl={previewUrl}
      alt={form.alt || form.name}
      crop={form.crop}
      onApply={(nextCrop) => { setForm((current) => ({ ...current, crop: nextCrop })); setCropModalOpen(false) }}
      onClose={() => setCropModalOpen(false)}
    />}
  </>

  return <Container className="p-6" data-testid="jovy-logos-panel">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ui-border-base pb-4"><div><Heading level="h2">Logos</Heading><p className="text-ui-fg-subtle text-sm">Activos corporativos, familias canónicas y orden de aparición.</p></div><Button onClick={openCreate}>Nuevo logo</Button></div>
    {error && <p role="alert" className="mt-4 text-ui-fg-error">{error}</p>}
    {notice && <p role="status" className="mt-4 text-ui-fg-success">{notice}</p>}
    <section aria-label="Filtros de logos" className="mt-4 rounded-md border border-ui-border-base bg-ui-bg-subtle p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium">Buscar
          <Input
            type="search"
            aria-label="Buscar logos"
            placeholder="Nombre, slug o family_id"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Categoría
          <select
            aria-label="Filtrar logos por categoría"
            className="h-9 rounded-md border border-ui-border-base bg-ui-bg-field px-3"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categoryOptions.map((category) => (
              <option key={category.key} value={category.key}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Estado
          <select
            aria-label="Filtrar logos por estado"
            className="h-9 rounded-md border border-ui-border-base bg-ui-bg-field px-3"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as LogoStatusFilter)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>
        {filtersActive && <Button size="small" variant="secondary" onClick={clearFilters}>Limpiar filtros</Button>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge color="grey" data-testid="logo-stat-total">Total: {logos.length}</Badge>
        <Badge color="green" data-testid="logo-stat-active">Activos: {activeLogoCount}</Badge>
        <Badge color="blue" data-testid="logo-stat-filtered">Filtrados: {filteredLogos.length}</Badge>
        <p className="text-ui-fg-subtle text-xs">Los filtros solo ocultan filas; el orden global no cambia.</p>
      </div>
      {categories.length === 0 && <p className="mt-2 text-ui-fg-subtle text-xs">El catálogo aún no tiene categorías; el filtro de categoría queda vacío hasta sembrarlas.</p>}
    </section>
    <p className="mt-4 rounded-md bg-ui-bg-component px-3 py-2 text-ui-fg-subtle text-sm">El orden actual es global. Este contrato no persiste un orden independiente por categoría; usa las flechas accesibles para cambiarlo.</p>
    {loading ? <p className="mt-6 text-ui-fg-subtle" role="status">Cargando logos…</p> : logos.length === 0 ? <div className="mt-6 rounded-md border border-dashed border-ui-border-base p-8 text-center"><Heading level="h3">Aún no hay logos</Heading><p className="mt-2 text-ui-fg-subtle text-sm">Crea primer logo para definir recurso, familias y visibilidad.</p><Button className="mt-4" onClick={openCreate}>Crear logo</Button></div> : filteredLogos.length === 0 ? <div className="mt-6 rounded-md border border-dashed border-ui-border-base p-8 text-center" data-testid="jovy-logo-empty-filtered"><Heading level="h3">No hay logos con esos filtros</Heading><p className="mt-2 text-ui-fg-subtle text-sm">Ajusta la búsqueda, la categoría o el estado para volver a ver el orden completo.</p><Button className="mt-4" size="small" variant="secondary" onClick={clearFilters}>Limpiar filtros</Button></div> : <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="jovy-logo-grid">{filteredLogos.map((logo) => { const index = logos.findIndex((item) => item.id === logo.id); return <LogoCard key={logo.id} logo={logo} index={index} total={logos.length} isBusy={pendingLogoId === logo.id} isReordering={reordering} onEdit={() => openEdit(logo)} onDelete={() => void remove(logo)} onToggle={() => void toggle(logo)} onMove={(direction) => void move(index, direction)} /> })}</div>}
  </Container>
}
