import { Badge, Button, Container, Heading, Input, Textarea, usePrompt } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react"

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

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const DEFAULT_CROP: Crop = { zoom: 1, offset_x: 0, offset_y: 0 }

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

function CropAdjuster({
  previewUrl,
  alt,
  crop,
  onChange,
}: {
  previewUrl: string | null
  alt: string
  crop: Crop
  onChange: (crop: Crop) => void
}) {
  const [gridVisible, setGridVisible] = useState(true)
  const drag = useRef<{ pointerId: number; x: number; y: number; crop: Crop } | null>(null)
  const clamp = (value: number) => Math.max(-80, Math.min(80, Math.round(value)))
  const nudge = (offsetX: number, offsetY: number) => onChange({
    ...crop,
    offset_x: clamp(crop.offset_x + offsetX),
    offset_y: clamp(crop.offset_y + offsetY),
  })
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!previewUrl) return
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, crop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = drag.current
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    onChange({
      ...activeDrag.crop,
      offset_x: clamp(activeDrag.crop.offset_x + ((event.clientX - activeDrag.x) / bounds.width) * 100),
      offset_y: clamp(activeDrag.crop.offset_y + ((event.clientY - activeDrag.y) / bounds.height) * 100),
    })
  }
  const stopDragging = () => { drag.current = null }

  return <section className="flex flex-col gap-y-3" aria-labelledby="logo-crop-heading">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><Heading id="logo-crop-heading" level="h3">Ajuste visual</Heading><p className="text-ui-fg-subtle text-sm">Arrastra para encuadrar. El zoom y la posición se guardan sin modificar archivo original.</p></div>
      <Button type="button" variant="secondary" size="small" onClick={() => onChange(DEFAULT_CROP)} disabled={!previewUrl}>Restablecer recorte</Button>
    </div>
    <div
      aria-label="Lienzo de recorte de logo"
      className="relative aspect-[16/8] w-full touch-none overflow-hidden rounded-md border border-ui-border-base bg-ui-bg-subtle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      style={{ cursor: previewUrl ? "grab" : "default" }}
    >
      {previewUrl ? <img src={previewUrl} alt={alt || "Vista previa de recorte de logo"} className="absolute inset-0 h-full w-full object-contain" style={cropForPreview(crop)} draggable={false} /> : <p className="flex h-full items-center justify-center px-4 text-center text-ui-fg-subtle text-sm">Carga un PNG, JPEG o WebP para ajustar encuadre.</p>}
      {gridVisible && previewUrl && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,.65) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.65) 1px, transparent 1px)", backgroundSize: "33.333% 33.333%" }} />}
    </div>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-medium">Zoom: {crop.zoom.toFixed(2)}×
        <input aria-label="Zoom logo" type="range" min="0.5" max="2" step="0.05" value={crop.zoom} onChange={(event) => onChange({ ...crop, zoom: Number(event.target.value) })} disabled={!previewUrl} />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} disabled={!previewUrl} /> Mostrar guía de tercios</label>
    </div>
    <div className="flex flex-wrap items-center gap-2" aria-label="Controles de desplazamiento del recorte">
      <Button type="button" variant="secondary" size="small" onClick={() => nudge(-5, 0)} disabled={!previewUrl}>← Mover izquierda</Button>
      <Button type="button" variant="secondary" size="small" onClick={() => nudge(5, 0)} disabled={!previewUrl}>Mover derecha →</Button>
      <Button type="button" variant="secondary" size="small" onClick={() => nudge(0, -5)} disabled={!previewUrl}>↑ Mover arriba</Button>
      <Button type="button" variant="secondary" size="small" onClick={() => nudge(0, 5)} disabled={!previewUrl}>Mover abajo ↓</Button>
    </div>
  </section>
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingLogoId, setPendingLogoId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      setError("El recurso debe ser PNG, JPEG o WebP.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("El recurso excede 5 MB. Selecciona una imagen PNG, JPEG o WebP de máximo 5 MB.")
      return
    }
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append("files", file)
      const result = await api<{ file: { id: string; url?: string } }>("/admin/jovy/marketing/media", { method: "POST", body })
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

  if (isFormOpen) return <Container className="p-6" data-testid="jovy-logo-form-panel">
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
          <div><label className="flex flex-col gap-1 text-sm font-medium">Recurso del logo <Input aria-label="Archivo de logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event.target.files?.[0])} disabled={uploading} /></label><p className="mt-1 text-ui-fg-subtle text-xs">PNG, JPEG o WebP · máximo 5 MB.</p>{uploading && <p role="status" className="mt-1 text-ui-fg-subtle text-sm">Cargando recurso…</p>}</div>
        </div></section>
        <section className="rounded-md border border-ui-border-base p-4"><CropAdjuster previewUrl={previewUrl} alt={form.alt || form.name} crop={form.crop} onChange={(crop) => setForm({ ...form, crop })} /></section>
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

  return <Container className="p-6" data-testid="jovy-logos-panel">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ui-border-base pb-4"><div><Heading level="h2">Logos</Heading><p className="text-ui-fg-subtle text-sm">Activos corporativos, familias canónicas y orden de aparición.</p></div><Button onClick={openCreate}>Nuevo logo</Button></div>
    {error && <p role="alert" className="mt-4 text-ui-fg-error">{error}</p>}
    {notice && <p role="status" className="mt-4 text-ui-fg-success">{notice}</p>}
    <p className="mt-4 rounded-md bg-ui-bg-component px-3 py-2 text-ui-fg-subtle text-sm">El orden actual es global. Este contrato no persiste un orden independiente por categoría; usa las flechas accesibles para cambiarlo.</p>
    {loading ? <p className="mt-6 text-ui-fg-subtle" role="status">Cargando logos…</p> : logos.length === 0 ? <div className="mt-6 rounded-md border border-dashed border-ui-border-base p-8 text-center"><Heading level="h3">Aún no hay logos</Heading><p className="mt-2 text-ui-fg-subtle text-sm">Crea primer logo para definir recurso, familias y visibilidad.</p><Button className="mt-4" onClick={openCreate}>Crear logo</Button></div> : <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="jovy-logo-grid">{logos.map((logo, index) => <LogoCard key={logo.id} logo={logo} index={index} total={logos.length} isBusy={pendingLogoId === logo.id} isReordering={reordering} onEdit={() => openEdit(logo)} onDelete={() => void remove(logo)} onToggle={() => void toggle(logo)} onMove={(direction) => void move(index, direction)} />)}</div>}
  </Container>
}
