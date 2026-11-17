import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Switch, Text, toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { adminRequest, errorMessage } from "../routes/jovy/components/admin-api"

/** Modalidad comercial: solo catálogo (informativo) o autorizada para la venta. */
type CommercialMode = "catalog_only" | "sellable"

/**
 * Panel editorial dentro del detalle nativo. Product Module conserva producto,
 * SKU, precio, inventario, variantes e imágenes; esta ficha solo añade datos de
 * presentación y su ciclo de publicación para Store.
 */
type ProductEditorial = {
  id: string
  product_id: string
  gramaje: string | null
  certifications: string[]
  sort_order: number
  is_new: boolean
  editorial_status: "draft" | "published" | "archived"
  published_at: string | null
  product_missing: boolean
  family: { id: string; slug: string; name: string } | null
  category_keys: string[]
  publish_issues: string[]
  /** null = producto histórico sin clasificar; se trata como informativo. */
  commercial_mode: CommercialMode | null
  /** Códigos pendientes para vender; si no llegan, se tratan como lista vacía. */
  sellable_requirements?: string[]
}

type EditorialDraft = {
  gramaje: string
  certifications: string[]
  sort_order: string
  is_new: boolean
  editorial_status: ProductEditorial["editorial_status"]
  commercial_mode: CommercialMode
}

/** Catálogo cerrado validado por servidor; el orden también es presentación. */
const CERTIFICATIONS = ["SGS", "OU Kosher", "Halal"] as const

const STATUS_LABELS: Record<ProductEditorial["editorial_status"], string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
}

const STATUS_BADGE: Record<ProductEditorial["editorial_status"], "grey" | "green" | "orange"> = {
  draft: "grey",
  published: "green",
  archived: "orange",
}

/** Nunca se preselecciona "sellable": por defecto toda ficha nueva es informativa. */
const emptyDraft = (): EditorialDraft => ({
  gramaje: "",
  certifications: [],
  sort_order: "0",
  is_new: false,
  editorial_status: "draft",
  commercial_mode: "catalog_only",
})

const draftFrom = (editorial: ProductEditorial): EditorialDraft => ({
  gramaje: editorial.gramaje ?? "",
  certifications: editorial.certifications,
  sort_order: String(editorial.sort_order),
  is_new: editorial.is_new,
  editorial_status: editorial.editorial_status,
  commercial_mode: editorial.commercial_mode === "sellable" ? "sellable" : "catalog_only",
})

const COMMERCIAL_MODE_BADGE: Record<CommercialMode, { label: string; color: "grey" | "green" }> = {
  catalog_only: { label: "CATALOG_ONLY — Informativo", color: "grey" },
  sellable: { label: "SELLABLE — Vendible", color: "green" },
}

/** Códigos del servidor traducidos; un código desconocido se muestra tal cual. */
const SELLABLE_REQUIREMENT_LABELS: Record<string, string> = {
  variants: "Variantes del producto configuradas",
  prices: "Precios definidos",
  sales_channel: "Canal de ventas asignado",
  inventory_policy: "Política de inventario configurada",
}

const selectClass = "border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive rounded-md border px-3 py-2 text-sm focus-visible:ring-2"

const labelClass = "text-ui-fg-subtle text-xs font-medium"

type ProductEditorialWidgetProps = {
  data: { id: string; title: string }
}

const ProductEditorialWidget = ({ data }: ProductEditorialWidgetProps) => {
  const prompt = usePrompt()
  const [editorial, setEditorial] = useState<ProductEditorial | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [draft, setDraft] = useState<EditorialDraft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // El listado filtrado responde 200 y evita registrar el 404 esperado de
      // una ficha aún inexistente durante cada visita al detalle nativo.
      const result = await adminRequest<{ products: Array<ProductEditorial & { deleted: boolean }> }>(
        `/admin/jovy/products/editorial?product_id=${encodeURIComponent(data.id)}`,
      )
      const [record] = result.products

      if (!record) {
        setEditorial(null)
        setDeleted(false)
        setDraft(emptyDraft())
      } else {
        const { deleted: isDeleted, ...editorialRecord } = record
        setEditorial(editorialRecord)
        setDeleted(isDeleted)
        setDraft(draftFrom(editorialRecord))
      }
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, "No se pudo cargar la ficha editorial."))
    } finally {
      setLoading(false)
    }
  }, [data.id])

  useEffect(() => {
    void load()
  }, [load])

  const update = (patch: Partial<EditorialDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const toggleCertification = (certification: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      certifications: checked
        ? [...current.certifications, certification]
        : current.certifications.filter((value) => value !== certification),
    }))
  }

  /** Pasar a vendible exige confirmación; nunca se inventan precios ni stock. */
  const changeCommercialMode = async (mode: CommercialMode) => {
    if (mode === draft.commercial_mode) return
    if (mode === "sellable") {
      const confirmed = await prompt({
        title: "Marcar producto como vendible",
        description:
          "Al marcarlo como vendible no se inventan precios ni stock y no se modifica el producto comercial nativo. La venta real requiere cumplir los requisitos comerciales y superar las validaciones del servidor; esta acción solo registra la intención comercial.",
        confirmText: "Marcar como vendible",
        cancelText: "Cancelar",
      })
      if (!confirmed) {
        // Fuerza el render para que el <select> controlado vuelva al valor confirmado.
        update({})
        return
      }
    }
    update({ commercial_mode: mode })
  }

  const persist = async (overrides: Partial<EditorialDraft> = {}) => {
    const next = { ...draft, ...overrides }
    const sortOrder = Number(next.sort_order)

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError("El orden debe ser un entero mayor o igual a cero.")
      return false
    }

    setSaving(true)
    setFormError(null)
    try {
      const result = await adminRequest<{ editorial: ProductEditorial; deleted: boolean }>(
        `/admin/jovy/products/${data.id}/editorial`,
        {
          method: "PUT",
          body: JSON.stringify({
            gramaje: next.gramaje.trim() || null,
            certifications: next.certifications,
            sort_order: sortOrder,
            is_new: next.is_new,
            editorial_status: next.editorial_status,
            commercial_mode: next.commercial_mode,
          }),
        },
      )
      setEditorial(result.editorial)
      setDeleted(result.deleted)
      setDraft(draftFrom(result.editorial))
      toast.success(
        next.editorial_status === "published"
          ? "Producto publicado en el catálogo editorial."
          : next.editorial_status === "archived"
            ? "Ficha editorial archivada."
            : "Ficha editorial guardada.",
      )
      return true
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la ficha editorial.")
      setFormError(message)
      toast.error(message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    const sortOrder = Number(draft.sort_order)
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError("El orden debe ser un entero mayor o igual a cero.")
      return
    }

    const confirmed = await prompt({
      title: editorial ? "Guardar cambios editoriales" : "Crear ficha editorial",
      description: editorial
        ? "Se guardarán los cambios de presentación y estado editorial. SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican."
        : "Se creará una ficha editorial en borrador. SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican.",
      confirmText: editorial ? "Guardar cambios" : "Guardar ficha",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    await persist()
  }

  const transition = async (status: ProductEditorial["editorial_status"]) => {
    const confirmed = await prompt({
      title: status === "published" ? "Publicar en Store" : "Archivar ficha editorial",
      description:
        status === "published"
          ? "La ficha quedará disponible para Store si el producto comercial también cumple sus requisitos."
          : "La ficha dejará de aparecer en Store. El producto comercial y sus datos no se modifican.",
      confirmText: status === "published" ? "Publicar en Store" : "Archivar ficha",
      cancelText: "Seguir editando",
    })
    if (!confirmed) return
    await persist({ editorial_status: status })
  }

  const restoreArchived = async () => {
    const confirmed = await prompt({
      title: "Restaurar a borrador",
      description: "La ficha editorial volverá a borrador y dejará de aparecer en Store. SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican.",
      confirmText: "Restaurar a borrador",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    await persist({ editorial_status: "draft" })
  }

  const remove = async () => {
    const confirmed = await prompt({
      title: "Eliminar ficha editorial",
      description: "Se eliminará solo esta ficha editorial. El producto comercial no se borra y podrás restaurar la ficha.",
      confirmText: "Eliminar ficha",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setSaving(true)
    try {
      await adminRequest(`/admin/jovy/products/${data.id}/editorial`, { method: "DELETE" })
      toast.success("Ficha editorial eliminada. Puedes restaurarla.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo eliminar la ficha editorial."))
    } finally {
      setSaving(false)
    }
  }

  const restoreDeleted = async () => {
    const confirmed = await prompt({
      title: "Restaurar ficha editorial",
      description: "La ficha editorial eliminada se restaurará con sus datos anteriores. SKU, precio, stock, variantes e imágenes del producto comercial nativo no se modifican.",
      confirmText: "Restaurar ficha",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setSaving(true)
    try {
      await adminRequest(`/admin/jovy/products/${data.id}/editorial/restore`, { method: "POST" })
      toast.success("Ficha editorial restaurada como estaba antes de eliminarla.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo restaurar la ficha editorial."))
    } finally {
      setSaving(false)
    }
  }

  const publishIssues = editorial
    ? editorial.publish_issues
    : ["guardar una ficha para que el servidor pueda comprobar los requisitos de publicación"]

  const commercialBadge = COMMERCIAL_MODE_BADGE[draft.commercial_mode]
  const isLegacyUnclassified = editorial?.commercial_mode == null
  const sellableRequirements = Array.isArray(editorial?.sellable_requirements)
    ? editorial.sellable_requirements
    : []

  return (
    <Container className="p-4 sm:p-6" data-testid="product-editorial-widget">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <Heading level="h2">Editor editorial Jovy</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Panel separado del producto comercial. Edita presentación y ciclo editorial; SKU, precio, stock, variantes e
            imágenes se mantienen en el detalle nativo de Medusa.
          </Text>
        </div>
        {editorial && <Badge color={STATUS_BADGE[editorial.editorial_status]} data-testid="editorial-status-badge">{STATUS_LABELS[editorial.editorial_status]}</Badge>}
      </div>

      {loading && <Text size="small" className="text-ui-fg-subtle mt-4" role="status">Cargando ficha editorial…</Text>}
      {loadError && <p role="alert" className="text-ui-fg-error mt-4 text-sm">{loadError}</p>}

      {!loading && !loadError && deleted && (
        <div className="mt-4 flex flex-col gap-y-3">
          <Text size="small" role="status">La ficha editorial está eliminada. El producto comercial sigue activo.</Text>
          <div className="flex flex-wrap gap-2">
            <Button size="small" onClick={() => void restoreDeleted()} isLoading={saving}>Restaurar ficha</Button>
            <Button type="button" size="small" variant="secondary" onClick={() => void load()} disabled={saving}>Actualizar</Button>
          </div>
        </div>
      )}

      {!loading && !loadError && !deleted && (
        <form className="mt-5 flex max-w-4xl flex-col gap-y-5" onSubmit={(event) => { event.preventDefault(); void save() }}>
          {editorial?.product_missing && <p role="alert" className="text-ui-fg-error text-sm">El producto comercial de esta ficha ya no existe en Medusa. Restaura o depura el registro antes de publicarlo.</p>}
          {!editorial && <Text size="small" className="text-ui-fg-subtle">Aún no hay ficha editorial. Guardar crea un borrador sin crear ni duplicar un producto comercial.</Text>}
          {formError && <p role="alert" className="text-ui-fg-error text-sm">{formError}</p>}

          <section aria-labelledby="editorial-commercial-heading" className="border-ui-border-base rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <Heading id="editorial-commercial-heading" level="h3">Modalidad comercial</Heading>
                <Text size="small" className="text-ui-fg-subtle mt-1">Define si esta ficha es informativa o está autorizada para la venta. No crea ni modifica un producto comercial.</Text>
              </div>
              <Badge color={commercialBadge.color} data-testid="commercial-mode-badge">{commercialBadge.label}</Badge>
            </div>

            {isLegacyUnclassified && (
              <p role="note" className="border-ui-border-base bg-ui-bg-subtle text-ui-fg-base mt-3 rounded-md border p-3 text-sm">Producto histórico sin clasificar: se trata como informativo y no se vende hasta autorización expresa.</p>
            )}

            <div className="mt-4 flex flex-col gap-y-1">
              <label htmlFor="editorial-commercial-mode" className={labelClass}>Modalidad comercial</label>
              <select
                id="editorial-commercial-mode"
                aria-label="Modalidad comercial"
                className={selectClass}
                value={draft.commercial_mode}
                disabled={saving}
                onChange={(event) => void changeCommercialMode(event.target.value as CommercialMode)}
              >
                <option value="catalog_only">Informativo (solo catálogo)</option>
                <option value="sellable">Vendible</option>
              </select>
            </div>

            <div className="mt-4" aria-live="polite">
              {draft.commercial_mode === "sellable" ? (
                sellableRequirements.length > 0 ? (
                  <div className="text-sm">
                    <Text size="small" weight="plus">Requisitos pendientes para vender</Text>
                    <ul className="mt-1 list-disc pl-5">
                      {sellableRequirements.map((code) => <li key={code}>{SELLABLE_REQUIREMENT_LABELS[code] ?? code}</li>)}
                    </ul>
                  </div>
                ) : (
                  <Text size="small" className="text-ui-fg-subtle">Requisitos comerciales completos según la información disponible; la venta sigue sujeta a validación del servidor.</Text>
                )
              ) : (
                <Text size="small" className="text-ui-fg-subtle">Este producto puede publicarse en el catálogo corporativo, pero no se puede añadir al carrito ni comprar.</Text>
              )}
            </div>
          </section>

          <section aria-labelledby="editorial-content-heading" className="border-ui-border-base rounded-lg border p-4">
            <Heading id="editorial-content-heading" level="h3">Presentación editorial</Heading>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">Campos visibles en el catálogo editorial; no sustituyen la información comercial.</Text>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="flex flex-col gap-y-1">
                <label htmlFor="editorial-gramaje" className={labelClass}>Gramaje</label>
                <Input id="editorial-gramaje" maxLength={50} placeholder="250 g" value={draft.gramaje} onChange={(event) => update({ gramaje: event.target.value })} />
                <Text size="xsmall" className="text-ui-fg-subtle">Texto corto opcional, máximo 50 caracteres.</Text>
              </div>
              <div className="flex flex-col gap-y-1">
                <label htmlFor="editorial-sort-order" className={labelClass}>Orden</label>
                <Input id="editorial-sort-order" type="number" min={0} step={1} value={draft.sort_order} onChange={(event) => update({ sort_order: event.target.value })} />
                <Text size="xsmall" className="text-ui-fg-subtle">Menor aparece antes.</Text>
              </div>
            </div>
            <fieldset className="mt-4 flex flex-col gap-y-2">
              <legend className={labelClass}>Certificaciones</legend>
              <Text size="xsmall" className="text-ui-fg-subtle">Selecciona una o varias del catálogo permitido por servidor.</Text>
              <div className="flex flex-wrap gap-x-5 gap-y-3">
                {CERTIFICATIONS.map((certification) => (
                  <label key={certification} className="flex min-h-6 items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4" checked={draft.certifications.includes(certification)} onChange={(event) => toggleCertification(certification, event.target.checked)} />
                    {certification}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 flex items-center gap-2">
              <Switch id="editorial-is-new" aria-label="Novedad" checked={draft.is_new} onCheckedChange={(checked) => update({ is_new: checked })} />
              <label htmlFor="editorial-is-new" className="text-sm font-medium">Marcar como novedad</label>
            </div>
          </section>

          <section aria-labelledby="editorial-catalogue-heading" className="border-ui-border-base rounded-lg border p-4">
            <Heading id="editorial-catalogue-heading" level="h3">Relación con catálogo</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">Familia y categorías se resuelven desde el producto comercial; aquí son informativas para evitar duplicar Product Module.</Text>
            <div className="mt-3 flex flex-col gap-y-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
              <span><strong>Familia:</strong> {editorial?.family?.name ?? "Sin familia"}</span>
              <span><strong>Categorías:</strong> {editorial?.category_keys.length ? editorial.category_keys.join(", ") : "Sin categoría de presentación"}</span>
              <a href="/app/jovy/catalogue" className="text-ui-fg-interactive underline">Ver relación de familia y categorías</a>
            </div>
          </section>

          <section aria-labelledby="editorial-publication-heading" className="border-ui-border-base rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Heading id="editorial-publication-heading" level="h3">Publicación editorial</Heading>
                <Text size="small" className="text-ui-fg-subtle mt-1">Estado actual: {STATUS_LABELS[editorial?.editorial_status ?? "draft"]}. Publicar o archivar pide confirmación y nunca cambia el producto comercial.</Text>
              </div>
              {editorial && <Badge color={STATUS_BADGE[editorial.editorial_status]}>{STATUS_LABELS[editorial.editorial_status]}</Badge>}
            </div>
            <div className="mt-3" aria-live="polite">
              {publishIssues.length > 0 ? (
                <div className="text-ui-fg-error text-sm"><Text size="small" weight="plus">Antes de publicar</Text><ul className="mt-1 list-disc pl-5">{publishIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>
              ) : <Text size="small" className="text-ui-fg-subtle">La ficha cumple los requisitos editoriales conocidos. Store también exige que el producto comercial esté publicado.</Text>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" size="small" isLoading={saving}>Guardar cambios</Button>
              <Button type="button" size="small" variant="secondary" disabled={saving || draft.editorial_status === "published"} onClick={() => void transition("published")}>Publicar en Store</Button>
              <Button type="button" size="small" variant="secondary" disabled={saving || draft.editorial_status === "archived"} onClick={() => void transition("archived")}>Archivar ficha</Button>
              {draft.editorial_status === "archived" && <Button type="button" size="small" variant="secondary" disabled={saving} onClick={() => void restoreArchived()}>Restaurar a borrador</Button>}
              {editorial && <Button type="button" size="small" variant="danger" disabled={saving} onClick={() => void remove()}>Eliminar ficha</Button>}
              <Button type="button" size="small" variant="secondary" disabled={saving} onClick={() => void load()}>Actualizar</Button>
            </div>
          </section>
        </form>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details",
  id: "jovy:product-editorial",
})

export default ProductEditorialWidget
