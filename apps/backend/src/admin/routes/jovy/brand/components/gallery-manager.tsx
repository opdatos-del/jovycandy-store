import { ArrowDownMini, ArrowUpMini } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text, Textarea, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  GALLERY_ACCEPT,
  galleryErrorMessage,
  galleryRequest,
  uploadGalleryImage,
  validateGalleryImage,
} from "./gallery-api"
import { GalleryAgenda } from "./gallery-agenda"
import { GalleryLightbox, type GalleryLightboxImage } from "./gallery-lightbox"
import {
  emptyGalleryDraft,
  formatWindow,
  fromDateTimeLocal,
  galleryTitle,
  isVisibleNow,
  nextSortOrder,
  publicationColor,
  publicationLabel,
  publicationState,
  statusColor,
  statusLabel,
  toDateTimeLocal,
  type GalleryDraft,
  type GalleryItem,
  type GalleryStatus,
} from "./gallery-model"
import { GalleryUpload } from "./gallery-upload"

type Response = { items: GalleryItem[] }

const restoreFocus = (element: HTMLElement | null) => {
  if (element?.isConnected) requestAnimationFrame(() => element.focus())
}

export const BrandGalleryManager = () => {
  const prompt = usePrompt()
  const headingRef = useRef<HTMLDivElement>(null)
  const nextOrderRef = useRef(0)

  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const [editing, setEditing] = useState<"new" | string | null>(null)
  const [form, setForm] = useState<GalleryDraft>(emptyGalleryDraft())
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [lightboxId, setLightboxId] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await galleryRequest<Response>("/admin/jovy/brand/gallery")
      setItems(response.items)
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

  const openCreate = () => {
    setActionError(null)
    setForm(emptyGalleryDraft())
    setPreviewUrl(null)
    setFormError(null)
    setEditing("new")
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
      setForm((current) => ({ ...current, media_file_id: uploaded.id }))
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
    if (saving || uploading) return
    if (!form.media_file_id.trim()) {
      setFormError("Selecciona una imagen antes de guardar.")
      return
    }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) {
      setFormError("La fecha de fin debe ser posterior a la fecha de inicio.")
      return
    }

    const isCreate = editing === "new"
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
      await galleryRequest(
        isCreate || !editing ? "/admin/jovy/brand/gallery" : `/admin/jovy/brand/gallery/${editing}`,
        { method: isCreate || !editing ? "POST" : "PUT", body: JSON.stringify(payload) },
      )
      setNotice(isCreate ? "Elemento creado." : "Elemento actualizado.")
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
    await galleryRequest("/admin/jovy/brand/gallery", {
      method: "POST",
      body: JSON.stringify({
        title: fallbackTitle,
        description: null,
        media_file_id: uploaded.id,
        status: "draft",
        enabled: true,
        sort_order: nextOrderRef.current,
        starts_at: null,
        ends_at: null,
      }),
    })
    nextOrderRef.current += 1
  }

  const changeStatus = async (item: GalleryItem, status: GalleryStatus) => {
    setPendingId(item.id)
    setActionError(null)
    try {
      await galleryRequest(`/admin/jovy/brand/gallery/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
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
      await galleryRequest(`/admin/jovy/brand/gallery/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !item.enabled }),
      })
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
      await galleryRequest("/admin/jovy/brand/gallery/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      })
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
      await galleryRequest(`/admin/jovy/brand/gallery/${item.id}`, { method: "DELETE" })
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
    const isCreate = editing === "new"
    return <Container className="p-6" data-testid="gallery-form-panel">
      <div className="border-ui-border-base mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div ref={headingRef} tabIndex={-1}>
          <Button type="button" variant="transparent" size="small" onClick={resetForm}>
            ← Volver a la galería
          </Button>
          <Heading level="h2">{isCreate ? "Nuevo elemento" : "Editar elemento"}</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            El ciclo de vida y la ventana de publicación se editan en este formulario; la lista solo
            cambia el orden y el estado rápido.
          </Text>
        </div>
      </div>

      {formError && <p role="alert" className="text-ui-fg-error mb-4">{formError}</p>}
      {notice && <p role="status" className="text-ui-fg-success mb-4">{notice}</p>}

      <form className="grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]" onSubmit={(event) => void save(event)}>
        <section className="border-ui-border-base flex flex-col gap-4 rounded-md border p-4">
          <Heading level="h3">Contenido</Heading>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Título
            <Input
              aria-label="Título galería"
              maxLength={180}
              value={form.title ?? ""}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Descripción
            <Textarea
              aria-label="Descripción galería"
              maxLength={2000}
              value={form.description ?? ""}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Imagen de galería
              <Input
                type="file"
                accept={GALLERY_ACCEPT}
                aria-label="Imagen de galería"
                disabled={uploading}
                onChange={(event) => {
                  void uploadFormImage(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
            </label>
            <p className="text-ui-fg-subtle mt-1 text-xs">PNG, JPEG o WebP · máximo 5 MB.</p>
            {uploading && <p role="status" className="text-ui-fg-subtle mt-1 text-sm">Cargando imagen…</p>}
            {previewUrl && <img
              src={previewUrl}
              alt="Vista previa de galería"
              className="border-ui-border-base mt-3 h-40 w-full max-w-xs rounded-md border object-cover"
            />}
          </div>
        </section>

        <section className="border-ui-border-base flex flex-col gap-4 rounded-md border p-4">
          <Heading level="h3">Publicación y ventana</Heading>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Estado
            <select
              aria-label="Estado galería"
              className="border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as GalleryStatus })}
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
            />
            Activo en Store
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Orden
            <Input
              type="number"
              min="0"
              aria-label="Orden galería"
              value={form.sort_order}
              onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Inicio de ventana
              <Input
                type="datetime-local"
                aria-label="Inicio galería"
                value={toDateTimeLocal(form.starts_at)}
                onChange={(event) => setForm({ ...form, starts_at: fromDateTimeLocal(event.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Fin de ventana
              <Input
                type="datetime-local"
                aria-label="Fin galería"
                value={toDateTimeLocal(form.ends_at)}
                onChange={(event) => setForm({ ...form, ends_at: fromDateTimeLocal(event.target.value) })}
              />
            </label>
          </div>
          <p className="text-ui-fg-subtle text-xs">
            Las fechas se escriben en tu hora local y se guardan en UTC. Sin ventana, el elemento
            queda visible mientras esté publicado y activo.
          </p>
        </section>

        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button type="submit" isLoading={saving} disabled={uploading}>
            {isCreate ? "Crear elemento" : "Guardar cambios"}
          </Button>
          <Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button>
        </div>
      </form>
    </Container>
  }

  const visibleNowCount = items.filter((item) => isVisibleNow(item)).length
  const draftCount = items.filter((item) => item.status === "draft").length

  return <div className="flex flex-col gap-y-4" data-testid="gallery-panel">
    <GalleryUpload
      visibleNow={visibleNowCount}
      draftCount={draftCount}
      onConfirm={confirmUpload}
      onUploadOne={uploadOne}
      onComplete={() => load(true)}
    />

    <Container className="p-6">
      <GalleryAgenda items={items} />
    </Container>

    <Container className="p-6" data-testid="gallery-list-panel">
      <div className="border-ui-border-base flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <Heading level="h2">Elementos de galería</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Orden de aparición, miniatura ampliable y acciones de ciclo de vida.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
            Actualizar
          </Button>
          <Button size="small" onClick={openCreate}>Nuevo elemento</Button>
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
            >
              Cargar imágenes
            </Button>
          </div>
          : <>
            <div className="text-ui-fg-subtle border-ui-border-base mt-4 hidden grid-cols-[7rem_minmax(0,1fr)_auto] gap-3 border-b px-3 pb-2 text-xs font-medium uppercase md:grid">
              <span>Orden</span>
              <span>Imagen y estado</span>
              <span className="text-right">Acciones</span>
            </div>
            <ul className="divide-ui-border-base divide-y" data-testid="gallery-items" aria-label="Elementos de la galería">
              {items.map((item, index) => {
                const title = galleryTitle(item)
                const state = publicationState(item)
                const itemBusy = pendingId === item.id || reordering
                return <li
                  key={item.id}
                  data-testid={`gallery-item-${item.id}`}
                  className="grid gap-3 px-3 py-4 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-center"
                  aria-busy={itemBusy}
                >
                  <div className="flex items-center gap-2 md:flex-col md:items-start">
                    <span className="text-ui-fg-subtle text-xs font-medium uppercase md:hidden">Orden</span>
                    <span className="text-sm font-medium tabular-nums">{index + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="small"
                        variant="secondary"
                        className="h-7 w-7 p-0"
                        aria-label={`Subir ${title}`}
                        onClick={() => void move(index, -1)}
                        disabled={itemBusy || index === 0}
                      >
                        <ArrowUpMini />
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        className="h-7 w-7 p-0"
                        aria-label={`Bajar ${title}`}
                        onClick={() => void move(index, 1)}
                        disabled={itemBusy || index === items.length - 1}
                      >
                        <ArrowDownMini />
                      </Button>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setLightboxId(item.id)}
                      disabled={!item.media_url}
                      aria-label={`Ampliar ${title}`}
                      className="border-ui-border-base bg-ui-bg-subtle focus-visible:ring-ui-border-interactive group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
                    >
                      {item.media_url
                        ? <img
                          src={item.media_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        : <span className="text-ui-fg-muted flex h-full items-center justify-center text-xs">Sin imagen</span>}
                    </button>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge color={statusColor(item.status)}>{statusLabel[item.status]}</Badge>
                        {item.status === "published" && <Badge color={publicationColor(state)}>{publicationLabel[state]}</Badge>}
                        <span className="text-ui-fg-subtle text-xs">{item.enabled ? "Activo" : "Inactivo"}</span>
                      </div>
                      {item.description && <p className="text-ui-fg-subtle mt-1 line-clamp-2 text-xs">{item.description}</p>}
                      <p className="text-ui-fg-subtle mt-1 text-xs">{formatWindow(item)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Button
                      size="small"
                      variant="secondary"
                      aria-label={`Editar ${title}`}
                      onClick={() => openEdit(item)}
                      disabled={itemBusy}
                    >
                      Editar
                    </Button>
                    {item.status === "published"
                      ? <Button
                        size="small"
                        variant="secondary"
                        aria-label={`Despublicar ${title}`}
                        onClick={() => void changeStatus(item, "draft")}
                        isLoading={pendingId === item.id}
                      >
                        Despublicar
                      </Button>
                      : <Button
                        size="small"
                        variant="secondary"
                        aria-label={`Publicar ${title}`}
                        onClick={() => void changeStatus(item, "published")}
                        isLoading={pendingId === item.id}
                      >
                        Publicar
                      </Button>}
                    {item.status !== "archived" && <Button
                      size="small"
                      variant="secondary"
                      aria-label={`Archivar ${title}`}
                      onClick={() => void changeStatus(item, "archived")}
                      disabled={itemBusy}
                    >
                      Archivar
                    </Button>}
                    <Button
                      size="small"
                      variant="secondary"
                      aria-label={`${item.enabled ? "Desactivar" : "Activar"} ${title}`}
                      onClick={() => void toggleEnabled(item)}
                      disabled={itemBusy}
                    >
                      {item.enabled ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      size="small"
                      variant="danger"
                      aria-label={`Eliminar ${title}`}
                      onClick={() => void remove(item)}
                      disabled={itemBusy}
                    >
                      Eliminar
                    </Button>
                  </div>
                </li>
              })}
            </ul>
          </>}
    </Container>

    <GalleryLightbox
      images={lightboxImages}
      activeId={lightboxId}
      onClose={() => setLightboxId(null)}
      onSelect={setLightboxId}
    />
  </div>
}
