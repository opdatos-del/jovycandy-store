import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Tag } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { adminRequest, errorMessage, uploadJovyImage } from "../components/admin-api"
import { CatalogueCategoryCard } from "./components/category-card"
import { CatalogueCategoryForm } from "./components/category-form"
import {
  draftFromCategory,
  effectiveInteractionLocked,
  type CatalogueCategory,
  type CatalogueDraft,
  type CatalogueFamily,
  type MedusaCategory,
} from "./components/catalogue-types"
import { CatalogueStorefrontPreview } from "./components/storefront-preview"

const CATALOGUE_CARD_COUNT = 6

const CataloguePage = () => {
  const prompt = usePrompt()
  const [categories, setCategories] = useState<CatalogueCategory[]>([])
  const [families, setFamilies] = useState<CatalogueFamily[]>([])
  const [medusaCategories, setMedusaCategories] = useState<MedusaCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sideWarning, setSideWarning] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CatalogueDraft | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const categoryResult = await adminRequest<{ categories: CatalogueCategory[] }>(
        "/admin/jovy/catalogue/categories",
      )
      setCategories(categoryResult.categories)
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, "No se pudieron cargar las categorías del catálogo."))
      setLoading(false)
      return
    }

    const [familyResult, medusaResult] = await Promise.allSettled([
      adminRequest<{ families: CatalogueFamily[] }>("/admin/jovy/catalogue/families"),
      adminRequest<{ product_categories?: MedusaCategory[] }>("/admin/product-categories?limit=200&order=name"),
    ])

    setFamilies(familyResult.status === "fulfilled" ? familyResult.value.families : [])
    setMedusaCategories(medusaResult.status === "fulfilled" ? medusaResult.value.product_categories ?? [] : [])
    setSideWarning(
      familyResult.status === "rejected" || medusaResult.status === "rejected"
        ? "Algunos datos auxiliares no se pudieron cargar; las tarjetas siguen siendo editables."
        : null,
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startEditing = (category: CatalogueCategory) => {
    setEditingId(category.id)
    setDraft(draftFromCategory(category))
    setPreviewUrl(category.image_resolved_url)
    setFormError(null)
    void adminRequest<{ product_categories?: MedusaCategory[] }>("/admin/product-categories?limit=200&order=name")
      .then((result) => setMedusaCategories(result.product_categories ?? []))
      .catch(() => undefined)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setDraft(null)
    setPreviewUrl(null)
    setFormError(null)
  }

  /**
   * Mantiene la combinación que entiende el storefront: Próximamente deja la
   * tarjeta inactiva y bloqueada. Al desmarcarlo se reactiva y se libera la
   * interacción; un bloqueo manual posterior (sin Próximamente) se respeta.
   */
  const changeDraft = (patch: Partial<CatalogueDraft>) => {
    setDraft((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      if (patch.coming_soon === true) {
        next.active = false
        next.interaction_locked = true
      }
      if (patch.coming_soon === false && current.coming_soon) {
        next.active = true
        next.interaction_locked = false
      }
      if (patch.active === true) next.coming_soon = false
      return next
    })
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    setFormError(null)
    try {
      const uploaded = await uploadJovyImage(file)
      changeDraft({ image_file_id: uploaded.id })
      setPreviewUrl(uploaded.url)
      toast.success("Imagen cargada. Guarda la tarjeta para asociarla.")
    } catch (error) {
      const message = errorMessage(error, "No se pudo cargar la imagen.")
      setFormError(message)
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    changeDraft({ image_file_id: null, image_url: "" })
    setPreviewUrl(null)
  }

  const save = async () => {
    const editingCategory = categories.find((category) => category.id === editingId)
    if (!editingId || !draft || !editingCategory) return
    const name = draft.name.trim()
    if (name.length < 2) {
      setFormError("El nombre debe tener al menos 2 caracteres.")
      return
    }

    const imageUrl = draft.image_url.trim()
    if (imageUrl && !imageUrl.startsWith("https://")) {
      setFormError("La URL de imagen externa debe usar HTTPS.")
      return
    }

    const nextActive = draft.coming_soon ? false : draft.active
    const statusChanged =
      editingCategory.active !== nextActive || editingCategory.coming_soon !== draft.coming_soon
    if (statusChanged) {
      const confirmed = await prompt({
        title: "Confirmar cambio de estado",
        description: draft.coming_soon
          ? "La categoría quedará como Próximamente, inactiva y sin interacción en Store."
          : nextActive
            ? "La categoría volverá a estar activa y con interacción libre en Store."
            : "La categoría quedará inactiva y no se publicará en Store.",
        confirmText: "Guardar cambios",
        cancelText: "Seguir editando",
      })
      if (!confirmed) return
    }

    setSaving(true)
    setFormError(null)
    try {
      await adminRequest(`/admin/jovy/catalogue/categories/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          description: draft.description.trim() || null,
          active: nextActive,
          coming_soon: draft.coming_soon,
          interaction_locked: effectiveInteractionLocked(draft),
          medusa_category_id: draft.medusa_category_id || null,
          image_file_id: draft.image_file_id,
          image_url: imageUrl || null,
        }),
      })
      toast.success("Tarjeta de catálogo guardada.")
      cancelEditing()
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la tarjeta.")
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Alterna Próximamente desde la tarjeta. Aplica la misma regla histórica que
   * el formulario: marcar deja la categoría inactiva y bloqueada; desmarcar la
   * reactiva y libera la interacción. Cancelar la confirmación no muta nada.
   */
  const toggleComingSoon = async (category: CatalogueCategory) => {
    const comingSoon = !category.coming_soon
    const confirmed = await prompt({
      title: comingSoon ? "Marcar como Próximamente" : "Quitar Próximamente",
      description: comingSoon
        ? "La categoría quedará como Próximamente, inactiva y sin interacción en Store."
        : "La categoría volverá a estar activa y con interacción libre en Store.",
      confirmText: "Confirmar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setTogglingId(category.id)
    setToggleError(null)
    try {
      await adminRequest(`/admin/jovy/catalogue/categories/${category.id}`, {
        method: "PUT",
        body: JSON.stringify({
          coming_soon: comingSoon,
          active: !comingSoon,
          interaction_locked: comingSoon,
        }),
      })
      toast.success(
        comingSoon ? "Categoría marcada como Próximamente." : "Categoría reactivada en Store.",
      )
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo cambiar el estado de la categoría.")
      setToggleError(message)
      toast.error(message)
    } finally {
      setTogglingId(null)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= categories.length) return
    const ids = categories.map((category) => category.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    setReordering(true)
    try {
      await adminRequest("/admin/jovy/catalogue/categories/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      })
      toast.success("Orden del catálogo actualizado.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo reordenar el catálogo."))
    } finally {
      setReordering(false)
    }
  }

  const seed = async () => {
    const confirmed = await prompt({
      title: "Crear tarjetas faltantes",
      description: "Solo se crearán tarjetas faltantes con sus valores iniciales. Nunca se sobrescriben tarjetas existentes.",
      confirmText: "Sembrar tarjetas",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    setSeeding(true)
    try {
      const result = await adminRequest<{ created: number }>("/admin/jovy/catalogue/categories/seed", {
        method: "POST",
        body: JSON.stringify({}),
      })
      toast.success(
        result.created === 0
          ? "Las seis tarjetas ya existían; no se modificó ninguna."
          : `${result.created} ${result.created === 1 ? "tarjeta creada" : "tarjetas creadas"}.`,
      )
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo ejecutar el seed."))
    } finally {
      setSeeding(false)
    }
  }

  const editingCategory = categories.find((category) => category.id === editingId)
  if (editingCategory && draft) {
    return (
      <CatalogueCategoryForm
        category={editingCategory}
        draft={draft}
        medusaCategories={medusaCategories}
        previewUrl={previewUrl}
        uploading={uploading}
        saving={saving}
        error={formError}
        onBack={cancelEditing}
        onChange={changeDraft}
        onUpload={(file) => void uploadImage(file)}
        onRemoveImage={removeImage}
        onSave={() => void save()}
      />
    )
  }

  const missing = Math.max(CATALOGUE_CARD_COUNT - categories.length, 0)
  const activeCount = categories.filter((category) => category.active && !category.coming_soon).length
  const comingSoonCount = categories.filter((category) => category.coming_soon).length
  const linkedCount = categories.filter((category) => category.medusa_category_id).length

  return (
    <div className="flex flex-col gap-y-4" data-testid="jovy-catalogue-page">
      <Container className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1">Categorías del catálogo</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Seis tarjetas de presentación para Store. Cada clave pública es fija; el contenido y estado se editan por separado.
            </Text>
          </div>
          <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
            Actualizar
          </Button>
        </div>
        {loadError && (
          <Text size="small" role="alert" className="text-ui-fg-error mt-3">
            {loadError}
          </Text>
        )}
        {sideWarning && (
          <Text size="small" role="status" className="text-ui-fg-subtle mt-3">
            {sideWarning}
          </Text>
        )}
        {toggleError && (
          <Text size="small" role="alert" className="text-ui-fg-error mt-3">
            {toggleError}
          </Text>
        )}
      </Container>

      {loading && categories.length === 0 ? (
        <Container className="p-6">
          <Text className="text-ui-fg-subtle" role="status">
            Cargando categorías…
          </Text>
        </Container>
      ) : categories.length === 0 ? (
        <Container className="p-6">
          <Heading level="h2">Todavía no hay tarjetas</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Las tarjetas se crean únicamente con el seed manual; cargar esta pantalla nunca modifica configuración.
          </Text>
          <Button className="mt-4" size="small" variant="secondary" onClick={() => void seed()} isLoading={seeding}>
            Sembrar seis tarjetas
          </Button>
        </Container>
      ) : (
        <>
          <Container className="p-6">
            <section aria-label="Resumen de categorías" className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="border-ui-border-base bg-ui-bg-base rounded-lg border p-4">
                <Text size="xsmall" className="text-ui-fg-subtle uppercase">
                  Categorías activas
                </Text>
                <Text className="mt-1 text-2xl font-semibold tabular-nums">{activeCount}</Text>
              </div>
              <div className="border-ui-border-base bg-ui-bg-base rounded-lg border p-4">
                <Text size="xsmall" className="text-ui-fg-subtle uppercase">
                  Próximamente
                </Text>
                <Text className="mt-1 text-2xl font-semibold tabular-nums">{comingSoonCount}</Text>
              </div>
              <div className="border-ui-border-base bg-ui-bg-base rounded-lg border p-4">
                <Text size="xsmall" className="text-ui-fg-subtle uppercase">
                  Vínculos comerciales
                </Text>
                <Text className="mt-1 text-2xl font-semibold tabular-nums">{linkedCount}</Text>
              </div>
            </section>
          </Container>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {categories.map((category, index) => {
              const categoryFamilies = families.filter(
                (family) => category.medusa_category_id && family.medusa_category_id === category.medusa_category_id,
              )
              return (
                <CatalogueCategoryCard
                  key={category.id}
                  category={category}
                  position={index}
                  total={categories.length}
                  families={categoryFamilies}
                  medusaCategories={medusaCategories}
                  reordering={reordering}
                  comingSoonPending={togglingId === category.id}
                  onEdit={() => startEditing(category)}
                  onMove={(direction) => void move(index, direction)}
                  onToggleComingSoon={() => void toggleComingSoon(category)}
                />
              )
            })}
          </div>

          <Container className="p-6">
            <div className="border-ui-border-base flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <Text size="small" weight="plus">
                  Mantenimiento manual
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                  {missing > 0
                    ? `Faltan ${missing} ${missing === 1 ? "tarjeta" : "tarjetas"}; el seed solo crea esas faltantes.`
                    : "Las seis tarjetas existen. El seed no cambia tarjetas ya creadas."}
                </Text>
              </div>
              <Button size="small" variant="secondary" onClick={() => void seed()} isLoading={seeding}>
                {missing > 0 ? "Sembrar tarjetas faltantes" : "Verificar seed manual"}
              </Button>
            </div>
          </Container>

          <Container className="p-6">
            <CatalogueStorefrontPreview categories={categories} />
          </Container>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Categorías",
  icon: Tag,
  rank: 3,
})

export default CataloguePage
