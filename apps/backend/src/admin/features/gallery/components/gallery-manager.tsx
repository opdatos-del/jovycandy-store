import { Button, Container, Heading, Text, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  createGalleryItem,
  deleteGalleryItem,
  galleryErrorMessage,
  listGallery,
  reorderGallery,
  setGalleryEnabled,
  setGalleryStatus,
  updateGalleryItem,
  uploadGalleryImage,
  validateGalleryImage,
} from "../api"
import { galleryTitle, isVisibleNow, nextSortOrder } from "../model"
import { emptyGalleryDraft, type GalleryDraft, type GalleryItem, type GalleryStatus } from "../types"
import { GalleryCard } from "./gallery-card"
import { GalleryForm } from "./gallery-form"
import { GalleryLightbox, type GalleryLightboxImage } from "./gallery-lightbox"
import { GalleryUpload } from "./gallery-upload"
import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"

const restoreFocus = (element: HTMLElement | null) => {
  if (element?.isConnected) requestAnimationFrame(() => element.focus())
}

/**
 * Gestor de la galería de Casa Jovy: carga, alta secuencial, edición, orden,
 * publicación y borrado. Los endpoints, confirmaciones y mensajes son los
 * mismos que usaba la pantalla original.
 */
export const BrandGalleryManager = () => {
  const prompt = usePrompt()
  const permissions = useJovyPermissions()
  const canCreate = permissions.can("jovy_gallery", "create")
  const canUpdate = permissions.can("jovy_gallery", "update")
  const canDelete = permissions.can("jovy_gallery", "delete")
  const canPublish = permissions.can("jovy_gallery", "publish")
  const canArchive = permissions.can("jovy_gallery", "archive")
  const headingRef = useRef<HTMLDivElement>(null)
  const nextOrderRef = useRef(0)

  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<GalleryDraft>(emptyGalleryDraft())
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [lightboxId, setLightboxId] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setItems(await listGallery())
      setLoadError(null)
    } catch (error) {
      setLoadError(galleryErrorMessage(error, "No se pudo cargar la galería."))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    nextOrderRef.current = nextSortOrder(items)
  }, [items])

  useEffect(() => {
    if (editing !== null) headingRef.current?.focus()
  }, [editing])

  const resetForm = () => {
    setEditing(null)
    setForm(emptyGalleryDraft())
    setPreviewUrl(null)
    setFormError(null)
  }

  const changeForm = (patch: Partial<GalleryDraft>) => {
    setForm((current) => ({ ...current, ...patch }))
  }

  const openEdit = (item: GalleryItem) => {
    setActionError(null)
    setEditing(item.id)
    setForm({
      title: item.title ?? "",
      description: item.description ?? "",
      media_file_id: item.media_file_id,
      status: item.status,
      enabled: item.enabled,
      sort_order: item.sort_order,
      starts_at: item.starts_at,
      ends_at: item.ends_at,
    })
    setPreviewUrl(item.media_url)
    setFormError(null)
  }

  const uploadFormImage = async (file?: File) => {
    if (!file) return
    const validation = validateGalleryImage(file)
    if (validation) {
      setFormError(validation)
      return
    }
    setUploading(true)
    setFormError(null)
    try {
      const uploaded = await uploadGalleryImage(file)
      changeForm({ media_file_id: uploaded.id })
      setPreviewUrl(uploaded.url)
      setNotice("Imagen cargada. Guarda el elemento para asociarla.")
    } catch (error) {
      setFormError(galleryErrorMessage(error, "No se pudo cargar la imagen."))
    } finally {
      setUploading(false)
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || uploading || !editing) return
    if (!form.media_file_id.trim()) {
      setFormError("Selecciona una imagen antes de guardar.")
      return
    }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      setFormError("La fecha de fin debe ser posterior a la fecha de inicio.")
      return
    }

    const sortOrder = Number.isFinite(form.sort_order) ? Math.max(0, Math.trunc(form.sort_order)) : 0
    const payload = {
      title: form.title?.trim() || null,
      description: form.description?.trim() || null,
      media_file_id: form.media_file_id,
      status: form.status,
      enabled: form.enabled,
      sort_order: sortOrder,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
    }

    setSaving(true)
    setFormError(null)
    try {
      await updateGalleryItem(editing, payload)
      setNotice("Elemento actualizado.")
      resetForm()
      await load(true)
    } catch (error) {
      setFormError(galleryErrorMessage(error, "No se pudo guardar el elemento."))
    } finally {
      setSaving(false)
    }
  }

  const confirmUpload = async (count: number) => prompt({
    title: "Cargar imágenes",
    description: count === 1
      ? "Subiré 1 imagen y crearé su elemento como borrador. No ocupará el cupo hasta que lo publiques."
      : `Subiré ${count} imágenes, una por una, y crearé sus elementos como borradores. No ocuparán el cupo hasta que los publiques.`,
    variant: "confirmation",
    confirmText: "Subir imágenes",
    cancelText: "Cancelar",
  })

  const uploadOne = async (file: File) => {
    const uploaded = await uploadGalleryImage(file)
    const fallbackTitle = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 180) || null
    await createGalleryItem({
      title: fallbackTitle,
      description: null,
      media_file_id: uploaded.id,
      status: "draft",
      enabled: true,
      sort_order: nextOrderRef.current,
      starts_at: null,
      ends_at: null,
    })
    nextOrderRef.current += 1
  }

  const changeStatus = async (item: GalleryItem, status: GalleryStatus) => {
    setPendingId(item.id)
    setActionError(null)
    try {
      await setGalleryStatus(item.id, status)
      setNotice(
        status === "published" ? "Elemento publicado."
          : status === "archived" ? "Elemento archivado."
            : "Elemento despublicado como borrador.",
      )
      await load(true)
    } catch (error) {
      setActionError(galleryErrorMessage(error, "No se pudo actualizar el estado."))
    } finally {
      setPendingId(null)
    }
  }

  const toggleEnabled = async (item: GalleryItem) => {
    setPendingId(item.id)
    setActionError(null)
    try {
      await setGalleryEnabled(item.id, !item.enabled)
      setNotice(item.enabled ? "Elemento desactivado." : "Elemento activado.")
      await load(true)
    } catch (error) {
      setActionError(galleryErrorMessage(error, "No se pudo actualizar la visibilidad."))
    } finally {
      setPendingId(null)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    if (reordering) return
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const item = items[index]
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const confirmed = await prompt({
      title: "Cambiar orden de la galería",
      description: `Moveré “${galleryTitle(item)}” una posición hacia ${direction === -1 ? "arriba" : "abajo"}. El resto conserva su orden relativo.`,
      variant: "confirmation",
      confirmText: "Cambiar orden",
      cancelText: "Cancelar",
    })
    if (!confirmed) {
      restoreFocus(trigger)
      return
    }

    const ids = items.map((entry) => entry.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    setReordering(true)
    setActionError(null)
    try {
      await reorderGallery(ids)
      setNotice("Orden de la galería actualizado.")
      await load(true)
    } catch (error) {
      setActionError(galleryErrorMessage(error, "No se pudo reordenar la galería."))
    } finally {
      setReordering(false)
    }
  }

  const remove = async (item: GalleryItem) => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const confirmed = await prompt({
      title: "Eliminar elemento de galería",
      description: `Eliminarás “${galleryTitle(item)}”. El archivo compartido no se elimina.`,
      confirmText: "Eliminar elemento",
      cancelText: "Cancelar",
    })
    if (!confirmed) {
      restoreFocus(trigger)
      return
    }

    setPendingId(item.id)
    setActionError(null)
    try {
      await deleteGalleryItem(item.id)
      if (editing === item.id) resetForm()
      setNotice("Elemento eliminado.")
      await load(true)
    } catch (error) {
      setActionError(galleryErrorMessage(error, "No se pudo eliminar el elemento."))
    } finally {
      setPendingId(null)
    }
  }

  const lightboxImages = useMemo<GalleryLightboxImage[]>(() => items
    .filter((item) => Boolean(item.media_url))
    .map((item) => ({
      id: item.id,
      src: item.media_url as string,
      title: galleryTitle(item),
      description: item.description,
    })), [items])

  const isFormOpen = editing !== null

  if (isFormOpen) {
    return <GalleryForm
      form={form}
      previewUrl={previewUrl}
      uploading={uploading}
      saving={saving}
      formError={formError}
      notice={notice}
      headingRef={headingRef}
      onChange={changeForm}
      onUpload={(file) => void uploadFormImage(file)}
      onSubmit={(event) => void save(event)}
      onCancel={resetForm}
    />
  }

  const visibleNowCount = items.filter((item) => isVisibleNow(item)).length
  const draftCount = items.filter((item) => item.status === "draft").length

  return <div className="flex flex-col gap-y-4" data-testid="gallery-panel">
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
      {canCreate ? <GalleryUpload
        visibleNow={visibleNowCount}
        draftCount={draftCount}
        onConfirm={confirmUpload}
        onUploadOne={uploadOne}
        onComplete={() => load(true)}
      /> : <Container className="p-6">
        <Heading level="h2" className="jovy-subtitle">Carga de imágenes</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Tu rol puede consultar la galería, pero no crear elementos.
        </Text>
      </Container>}

      <Container className="p-6" data-testid="gallery-list-panel">
        <div className="border-ui-border-base flex flex-wrap items-end justify-between gap-3 border-b pb-4">
          <div>
            <Heading level="h2" className="jovy-subtitle">Elementos de galería</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Orden de aparición, miniatura ampliable y acciones de ciclo de vida.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
              Actualizar
            </Button>
          </div>
        </div>

        {loadError && <div role="alert" className="mt-4 flex flex-wrap items-center gap-3">
          <Text size="small" className="text-ui-fg-error">{loadError}</Text>
          <Button size="small" variant="secondary" onClick={() => void load()}>Reintentar</Button>
        </div>}
        {actionError && <p role="alert" className="text-ui-fg-error mt-4 text-sm" data-testid="gallery-action-error">{actionError}</p>}
        {notice && <p role="status" className="text-ui-fg-success mt-4 text-sm">{notice}</p>}

        {loading && items.length === 0
          ? <p role="status" className="text-ui-fg-subtle mt-6">Cargando galería…</p>
          : items.length === 0
            ? <div className="border-ui-border-base mt-6 rounded-md border border-dashed p-8 text-center">
              <Heading level="h3">Aún no hay imágenes</Heading>
              <p className="text-ui-fg-subtle mx-auto mt-2 max-w-md text-sm">
                Usa el bloque de carga para subir una o varias imágenes. Se crean como borradores y
                puedes publicarlas cuando quieras.
              </p>
              <Button
                className="mt-4"
                onClick={() => document.getElementById("gallery-file-input")?.focus()}
                disabled={!canCreate}
              >
                Cargar imágenes
              </Button>
            </div>
            : <>
              <div className="jovy-gallery-head text-ui-fg-subtle border-ui-border-base mt-4 hidden grid-cols-[7rem_minmax(0,1fr)_auto] gap-3 border-b px-3 pb-2 text-xs font-medium uppercase">
                <span>Orden</span>
                <span>Imagen y estado</span>
                <span className="text-right">Acciones</span>
              </div>
              <ul className="jovy-gallery-list divide-ui-border-base divide-y" data-testid="gallery-items" aria-label="Elementos de la galería">
                {items.map((item, index) => <GalleryCard
                  key={item.id}
                  item={item}
                  index={index}
                  total={items.length}
                  busy={pendingId === item.id || reordering}
                  pending={pendingId === item.id}
                  onMove={(rowIndex, direction) => void move(rowIndex, direction)}
                  onOpenLightbox={() => setLightboxId(item.id)}
                  onEdit={() => openEdit(item)}
                  onChangeStatus={(status) => void changeStatus(item, status)}
                  onToggleEnabled={() => void toggleEnabled(item)}
                  onRemove={() => void remove(item)}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  canPublish={canPublish}
                  canArchive={canArchive}
                />)}
              </ul>
            </>}
      </Container>
    </div>

    <GalleryLightbox
      images={lightboxImages}
      activeId={lightboxId}
      onClose={() => setLightboxId(null)}
      onSelect={setLightboxId}
    />
  </div>
}
