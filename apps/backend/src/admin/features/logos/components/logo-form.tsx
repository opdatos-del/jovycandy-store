import { Badge, Button, Container, Heading, Input, Textarea } from "@medusajs/ui"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type RefObject,
  type SetStateAction,
} from "react"
import { CropModal } from "@admin/features/logos/components/crop-modal"
import { cropForPreview } from "@admin/features/logos/lib/crop"
import type { CatalogueCategory, Family, LogoForm } from "@admin/features/logos/types"

type LogoFormPanelProps = {
  /** `"new"` crea; cualquier otro valor es el id en edición. */
  editing: string | null
  form: LogoForm
  setForm: Dispatch<SetStateAction<LogoForm>>
  families: Family[]
  familyDirectory: Family[]
  categories: CatalogueCategory[]
  familyCategory: string
  legacyFamilies: string[]
  previewUrl: string | null
  uploading: boolean
  saving: boolean
  error: string | null
  notice: string | null
  /** El orquestador enfoca el botón si se cancela la confirmación de guardado. */
  saveButtonRef: RefObject<HTMLButtonElement>
  onSelectCategory: (categoryKey: string) => void
  onToggleFamily: (familyId: string) => void
  onUpload: (file?: File) => void
  onSave: (event: FormEvent) => void
  onClose: () => void
}

/**
 * Panel de edición de un logo. Mantiene el mismo formulario, validaciones y
 * testids del gestor histórico; el recorte se edita en un diálogo propio.
 */
export function LogoFormPanel({
  editing,
  form,
  setForm,
  families,
  familyDirectory,
  categories,
  familyCategory,
  legacyFamilies,
  previewUrl,
  uploading,
  saving,
  error,
  notice,
  saveButtonRef,
  onSelectCategory,
  onToggleFamily,
  onUpload,
  onSave,
  onClose,
}: LogoFormPanelProps) {
  const formTitle = useRef<HTMLDivElement>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)

  useEffect(() => { if (editing !== null) formTitle.current?.focus() }, [editing])

  const selectableFamilies = useMemo(() => [
    ...families,
    ...familyDirectory.filter((family) => form.family_ids.includes(family.id) && !families.some((item) => item.id === family.id)),
  ], [families, familyDirectory, form.family_ids])
  const familyName = (id: string) => familyDirectory.find((family) => family.id === id)?.name ?? id

  return <>
    <Container className="p-6" data-testid="jovy-logo-form-panel">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ui-border-base pb-4">
      <div ref={formTitle} tabIndex={-1}><Button type="button" variant="transparent" size="small" onClick={onClose}>← Volver a logos</Button><Heading level="h2">{editing === "new" ? "Nuevo logo" : "Editar logo"}</Heading><p className="text-ui-fg-subtle text-sm">Recurso, familias y encuadre se editan en este panel separado.</p></div>
    </div>
    {error && <p role="alert" className="mb-4 text-ui-fg-error">{error}</p>}
    {notice && <p role="status" className="mb-4 text-ui-fg-success">{notice}</p>}
    <form id="jovy-logo-form" className="grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,.85fr)]" onSubmit={onSave}>
      <div className="flex flex-col gap-5">
        <section className="rounded-md border border-ui-border-base p-4"><Heading level="h3">Información y recurso</Heading><div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm font-medium">Slug <Input required aria-label="Slug logo" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="marca-corporativa" /></label><label className="flex flex-col gap-1 text-sm font-medium">Nombre <Input required aria-label="Nombre logo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label></div>
          <label className="flex flex-col gap-1 text-sm font-medium">Texto alternativo <Textarea aria-label="Texto alternativo logo" value={form.alt || ""} onChange={(event) => setForm({ ...form, alt: event.target.value || null })} /></label>
          <div><label className="flex flex-col gap-1 text-sm font-medium">Recurso del logo <Input aria-label="Archivo de logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void onUpload(event.target.files?.[0])} disabled={uploading} /></label><p className="mt-1 text-ui-fg-subtle text-xs">PNG, JPEG, WebP o GIF · máximo 20 MB.</p>{uploading && <p role="status" className="mt-1 text-ui-fg-subtle text-sm">Cargando recurso…</p>}</div>
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
          <label className="flex flex-col gap-1 text-sm font-medium">Categoría del catálogo<select aria-label="Categoría de familias" className="h-9 rounded-md border border-ui-border-base bg-ui-bg-field px-3" value={familyCategory} onChange={(event) => onSelectCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.key} value={category.key}>{category.name}</option>)}</select></label>
          {categories.length === 0 && <p className="text-ui-fg-subtle text-sm">El catálogo aún no tiene categorías; las familias se listan sin filtro.</p>}
          {familyCategory && selectableFamilies.length === 0 && <p className="text-ui-fg-subtle text-sm">La categoría seleccionada no tiene familias vinculadas.</p>}
          <fieldset className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border border-ui-border-base p-3"><legend className="px-1 text-sm font-medium">Familias canónicas</legend>{selectableFamilies.length === 0 ? <p className="text-ui-fg-subtle text-sm">No hay familias disponibles.</p> : selectableFamilies.map((family) => <label key={family.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.family_ids.includes(family.id)} onChange={() => onToggleFamily(family.id)} aria-label={`Familia ${family.name}`} /><span>{family.name}</span>{!family.active && <Badge color="grey">inactiva</Badge>}{!families.some((item) => item.id === family.id) && <Badge color="orange">fuera de categoría</Badge>}</label>)}</fieldset>
          {form.family_ids.length > 0 && <p className="text-ui-fg-subtle text-sm">Seleccionadas: {form.family_ids.map(familyName).join(", ")}</p>}
          {legacyFamilies.length > 0 && <p role="status" className="rounded bg-ui-bg-component p-3 text-ui-fg-subtle text-sm">Relaciones de legado sin equivalente: {legacyFamilies.join(", ")}. Se muestran como referencia, no se envían; el contrato canónico es <code>family_ids</code>.</p>}
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Activo en Store</label>
        </div></section>
        <div className="flex flex-wrap gap-2"><Button ref={saveButtonRef} type="submit" isLoading={saving} disabled={uploading}>{editing === "new" ? "Crear logo" : "Guardar cambios"}</Button><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button></div>
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
}
