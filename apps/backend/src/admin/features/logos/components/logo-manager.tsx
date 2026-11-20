import { Badge, Button, Container, Heading, Input, usePrompt } from "@medusajs/ui"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  deleteLogo,
  fetchCategories,
  fetchFamilies,
  fetchLogos,
  reorderLogos,
  saveLogo,
  setLogoEnabled,
  uploadLogoMedia,
  validateLogoMedia,
} from "@admin/features/logos/api"
import { LogoCard } from "@admin/features/logos/components/logo-card"
import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"
import { LogoFormPanel } from "@admin/features/logos/components/logo-form"
import {
  DEFAULT_CROP,
  emptyLogo,
  type CatalogueCategory,
  type Family,
  type Logo,
  type LogoForm,
  type LogoStatusFilter,
} from "@admin/features/logos/types"
import { errorMessage } from "@admin/shared/lib/admin-api"

/**
 * Orquestador de «Logos»: carga el catálogo, mantiene el formulario, aplica los
 * filtros locales y resuelve las mutaciones con su confirmación. El panel de
 * edición y las tarjetas viven en componentes propios de la feature.
 */
export function BrandLogoManager() {
  const prompt = usePrompt()
  const permissions = useJovyPermissions()
  const canCreate = permissions.can("jovy_logos", "create")
  const canUpdate = permissions.can("jovy_logos", "update")
  const canDelete = permissions.can("jovy_logos", "delete")
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
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<LogoStatusFilter>("all")

  const load = async () => {
    setLoading(true)
    try {
      const [logoList, familyList, categoryList] = await Promise.all([
        fetchLogos(),
        fetchFamilies(),
        fetchCategories(),
      ])
      setLogos(logoList)
      setFamilies(familyList)
      setFamilyDirectory(familyList)
      setCategories(categoryList)
      setError(null)
    } catch (loadError) {
      setError(errorMessage(loadError, "No se pudieron cargar los logos."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

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
      setFamilies(await fetchFamilies(categoryKey))
      setError(null)
    } catch (selectionError) {
      setError(errorMessage(selectionError, "No se pudieron cargar las familias de esta categoría."))
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
    const validationError = validateLogoMedia(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const result = await uploadLogoMedia(file)
      setForm((current) => ({ ...current, media_file_id: result.id }))
      setPreviewUrl(result.url || URL.createObjectURL(file))
      setNotice("Recurso cargado. Guarda el formulario para asociarlo al logo.")
    } catch (uploadError) {
      setError(errorMessage(uploadError, "No se pudo cargar el recurso."))
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
      await saveLogo(isCreate ? null : editing, form)
      setNotice("Logo guardado.")
      resetForm()
      await load()
    } catch (saveError) {
      setError(errorMessage(saveError, "No se pudo guardar el logo."))
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
      await setLogoEnabled(logo.id, enabled)
      setNotice(enabled ? "Logo activado." : "Logo desactivado.")
      await load()
    } catch (toggleError) {
      setError(errorMessage(toggleError, "No se pudo actualizar el logo."))
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
      await deleteLogo(logo.id)
      setNotice("Logo eliminado.")
      await load()
    } catch (removeError) {
      setError(errorMessage(removeError, "No se pudo eliminar el logo."))
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
      await reorderLogos(ids)
      setNotice("Orden de logos actualizado.")
      await load()
    } catch (moveError) {
      setError(errorMessage(moveError, "No se pudo reordenar el logo."))
    } finally {
      setReordering(false)
    }
  }

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

  if (editing !== null) return <LogoFormPanel
    editing={editing}
    form={form}
    setForm={setForm}
    families={families}
    familyDirectory={familyDirectory}
    categories={categories}
    familyCategory={familyCategory}
    legacyFamilies={legacyFamilies}
    previewUrl={previewUrl}
    uploading={uploading}
    saving={saving}
    error={error}
    notice={notice}
    saveButtonRef={saveButton}
    onSelectCategory={(categoryKey) => void selectCategory(categoryKey)}
    onToggleFamily={toggleFamily}
    onUpload={(file) => void upload(file)}
    onSave={(event) => void save(event)}
    onClose={resetForm}
  />

  return <Container className="p-6" data-testid="jovy-logos-panel">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ui-border-base pb-4"><div><p className="text-ui-fg-subtle text-sm">Activos corporativos, familias canónicas y orden de aparición.</p></div>{canCreate && <Button onClick={openCreate}>Nuevo logo</Button>}</div>
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
    {loading ? <p className="mt-6 text-ui-fg-subtle" role="status">Cargando logos…</p> : logos.length === 0 ? <div className="mt-6 rounded-md border border-dashed border-ui-border-base p-8 text-center"><Heading level="h3">Aún no hay logos</Heading><p className="mt-2 text-ui-fg-subtle text-sm">Crea primer logo para definir recurso, familias y visibilidad.</p><Button className="mt-4" onClick={openCreate} disabled={!canCreate}>Crear logo</Button></div> : filteredLogos.length === 0 ? <div className="mt-6 rounded-md border border-dashed border-ui-border-base p-8 text-center" data-testid="jovy-logo-empty-filtered"><Heading level="h3">No hay logos con esos filtros</Heading><p className="mt-2 text-ui-fg-subtle text-sm">Ajusta la búsqueda, la categoría o el estado para volver a ver el orden completo.</p><Button className="mt-4" size="small" variant="secondary" onClick={clearFilters}>Limpiar filtros</Button></div> : <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="jovy-logo-grid">{filteredLogos.map((logo) => { const index = logos.findIndex((item) => item.id === logo.id); return <LogoCard key={logo.id} logo={logo} index={index} total={logos.length} isBusy={pendingLogoId === logo.id} isReordering={reordering} onEdit={() => openEdit(logo)} onDelete={() => void remove(logo)} onToggle={() => void toggle(logo)} onMove={(direction) => void move(index, direction)} canUpdate={canUpdate} canDelete={canDelete} /> })}</div>}
  </Container>
}
