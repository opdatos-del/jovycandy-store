import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Images } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text, toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { adminRequest, errorMessage } from "../components/admin-api"
// eslint-disable-next-line no-restricted-imports -- el Vite del Admin no resuelve el alias @jovy; la ruta relativa cruzando grupos es necesaria
import { canMoveEventWithinPriority, moveEventWithinPriority } from "../../jovy-herramientas/events/ordering"
import { NoveltyCard } from "./components/novelty-card"
import { NoveltyForm } from "./components/novelty-form"
import {
  draftFromEvent,
  draftPayload,
  emptyDraft,
  emptyFilters,
  filterNovelties,
  hasActiveFilters,
  isValidSlug,
  mediaLaneForFile,
  noveltyStoreState,
  publishIssues,
  type NoveltyDraft,
  type NoveltyEvent,
  type NoveltyFilters,
  type NoveltyMediaType,
} from "./model"

/**
 * Administración del carrusel horizontal de Novedades. A diferencia de un CRUD
 * genérico, la pantalla se organiza como tablero multimedia: cada tarjeta es la
 * novedad real que consume Store, con su estado editorial y su visibilidad
 * efectiva separados para no etiquetar como publicada una novedad oculta.
 */

type EventType = { id: string; name: string; code: string }

type UploadedMedia = { id: string; url: string | null; media_type: NoveltyMediaType }

const statusFilterOptions: Array<{ value: NoveltyFilters["status"]; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "published", label: "Publicadas" },
  { value: "draft", label: "Borradores" },
  { value: "archived", label: "Archivadas" },
  { value: "cancelled", label: "Canceladas" },
]

const mediaFilterOptions: Array<{ value: NoveltyFilters["media"]; label: string }> = [
  { value: "all", label: "Todos los medios" },
  { value: "image", label: "Imagen" },
  { value: "gif", label: "GIF" },
  { value: "video", label: "Vídeo" },
  { value: "none", label: "Sin multimedia" },
]

const activeFilterOptions: Array<{ value: NoveltyFilters["active"]; label: string }> = [
  { value: "all", label: "Activas e inactivas" },
  { value: "yes", label: "Sólo activas" },
  { value: "no", label: "Sólo inactivas" },
]

const mediaNoun = (type: NoveltyMediaType | null) =>
  type === "video" ? "vídeo" : type === "gif" ? "GIF" : "imagen"

const NoveltiesPage = () => {
  const prompt = usePrompt()
  const [events, setEvents] = useState<NoveltyEvent[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sideWarning, setSideWarning] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<NoveltyDraft | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [filters, setFilters] = useState<NoveltyFilters>(emptyFilters)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [eventsResult, typesResult] = await Promise.allSettled([
      adminRequest<{ events: NoveltyEvent[] }>("/admin/jovy/events"),
      adminRequest<{ event_types: EventType[] }>("/admin/jovy/events/types"),
    ])

    if (eventsResult.status === "fulfilled") {
      setEvents(eventsResult.value.events)
      setLoadError(null)
    } else {
      setLoadError(errorMessage(eventsResult.reason, "No se pudieron cargar las novedades."))
    }

    if (typesResult.status === "fulfilled") {
      setEventTypes(typesResult.value.event_types)
      setSideWarning(null)
    } else {
      setSideWarning(
        "No se pudieron cargar los tipos de evento. Las novedades existentes se pueden revisar, pero publicar requiere un tipo.",
      )
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Enlace profundo desde Eventos: resalta la tarjeta exacta sin abrir el editor
  // por sorpresa, para que el cambio de pantalla conserve el contexto.
  useEffect(() => {
    if (loading || events.length === 0) return
    const eventId = new URLSearchParams(window.location.search).get("event")
    if (!eventId || highlightedId === eventId) return
    if (!events.some((event) => event.id === eventId)) return

    setHighlightedId(eventId)
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-testid="novelty-card-${eventId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }, [events, loading, highlightedId])

  const filtered = useMemo(() => filterNovelties(events, filters), [events, filters])
  const filtersActive = hasActiveFilters(filters)

  const storeVisibleCount = events.filter((event) => noveltyStoreState(event).visible).length

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyDraft())
    setFormError(null)
    setActionError(null)
    setEditorOpen(true)
  }

  const openEditor = (event: NoveltyEvent) => {
    setEditingId(event.id)
    setDraft(draftFromEvent(event))
    setFormError(null)
    setActionError(null)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingId(null)
    setDraft(null)
    setFormError(null)
  }

  const changeDraft = (patch: Partial<NoveltyDraft>) => {
    // Un cambio del usuario invalida el mensaje anterior: mantenerlo visible
    // haría creer que el campo sigue mal aunque ya se haya corregido.
    setFormError(null)
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const putEvent = async (event: NoveltyEvent, patch: Record<string, unknown>, successMessage: string) => {
    setBusyId(event.id)
    setActionError(null)
    try {
      await adminRequest(`/admin/jovy/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      })
      toast.success(successMessage)
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo actualizar la novedad.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const publish = async (event: NoveltyEvent) => {
    const issues = publishIssues(event)
    if (issues.length > 0) {
      setActionError(`No se puede publicar “${event.title}”: falta ${issues.join(", ")}.`)
      openEditor(event)
      return
    }

    const confirmed = await prompt({
      title: "Publicar novedad",
      description: `“${event.title}” pasará a Store si su ventana está vigente, está activa y tiene multimedia.`,
      confirmText: "Publicar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    await putEvent(event, { status: "published" }, "Novedad publicada.")
  }

  const archive = async (event: NoveltyEvent) => {
    const confirmed = await prompt({
      title: "Archivar novedad",
      description: `“${event.title}” dejará de mostrarse en el carrusel de Store y quedará como archivada.`,
      confirmText: "Archivar",
      cancelText: "Cancelar",
    })
    if (!confirmed) return
    await putEvent(event, { status: "archived" }, "Novedad archivada.")
  }

  const toggleEnabled = async (event: NoveltyEvent) => {
    if (event.enabled) {
      const confirmed = await prompt({
        title: "Desactivar novedad",
        description: `“${event.title}” seguirá publicada, pero dejará de mostrarse en Store mientras esté inactiva.`,
        confirmText: "Desactivar",
        cancelText: "Cancelar",
      })
      if (!confirmed) return
    }
    await putEvent(
      event,
      { enabled: !event.enabled },
      event.enabled ? "Novedad desactivada; ya no se muestra en Store." : "Novedad activada.",
    )
  }

  const removeMedia = async (event: NoveltyEvent) => {
    const confirmed = await prompt({
      title: "Retirar multimedia",
      description: `“${event.title}” dejará de aparecer en el carrusel. El archivo permanece en el almacenamiento compartido y puede volver a asociarse.`,
      confirmText: "Retirar medio",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return
    await putEvent(event, { media_file_id: null }, "Multimedia retirada de la novedad.")
  }

  const deleteEvent = async (event: NoveltyEvent) => {
    const confirmed = await prompt({
      title: "Eliminar novedad",
      description: `Se eliminará “${event.title}”. El archivo multimedia no se borra del almacenamiento, pero la novedad y su vínculo desaparecen.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return

    setBusyId(event.id)
    setActionError(null)
    try {
      await adminRequest(`/admin/jovy/events/${event.id}`, { method: "DELETE" })
      if (editingId === event.id) closeEditor()
      toast.success("Novedad eliminada.")
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo eliminar la novedad.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const saveOrder = async (event: NoveltyEvent, order: { priority: number; sort_order: number }) => {
    await putEvent(event, order, "Prioridad y orden actualizados.")
  }

  const move = async (event: NoveltyEvent, direction: -1 | 1) => {
    const ordered = moveEventWithinPriority(events, event.id, direction)
    if (ordered === events) return

    setReordering(true)
    setActionError(null)
    try {
      await adminRequest("/admin/jovy/events/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: ordered.map((item) => item.id) }),
      })
      toast.success("Orden actualizado dentro del mismo grupo de prioridad.")
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo reordenar las novedades.")
      setActionError(message)
      toast.error(message)
    } finally {
      setReordering(false)
    }
  }

  const uploadMedia = async (file: File): Promise<UploadedMedia> => {
    const lane = mediaLaneForFile(file)
    if (!lane) {
      throw new Error("Solo se aceptan imágenes PNG/JPEG/WebP, GIF o vídeo MP4/WebM.")
    }

    const body = new FormData()
    body.append("files", file)

    if (lane === "image") {
      const uploaded = await adminRequest<{ file: { id: string; url?: string | null } }>(
        "/admin/jovy/marketing/media",
        { method: "POST", body },
      )
      return { id: uploaded.file.id, url: uploaded.file.url ?? null, media_type: "image" }
    }

    const uploaded = await adminRequest<{
      file: { id: string; url?: string | null }
      media_type: NoveltyMediaType
    }>("/admin/jovy/events/media/video", { method: "POST", body })
    return { id: uploaded.file.id, url: uploaded.file.url ?? null, media_type: uploaded.media_type }
  }

  const replaceCardMedia = async (event: NoveltyEvent, file: File) => {
    if (event.media_file_id) {
      const confirmed = await prompt({
        title: "Reemplazar multimedia",
        description: `“${event.title}” ya tiene ${mediaNoun(event.media_type)}. El archivo anterior permanece en el almacenamiento y la novedad usará el nuevo.`,
        confirmText: "Reemplazar",
        cancelText: "Cancelar",
      })
      if (!confirmed) return
    }

    setBusyId(event.id)
    setActionError(null)
    try {
      const uploaded = await uploadMedia(file)
      await adminRequest(`/admin/jovy/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({ media_file_id: uploaded.id }),
      })
      toast.success(`Multimedia actualizada (${mediaNoun(uploaded.media_type)}).`)
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo subir la multimedia.")
      setActionError(message)
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const uploadEditorMedia = async (file: File) => {
    if (!draft) return

    if (draft.media_file_id) {
      const confirmed = await prompt({
        title: "Reemplazar multimedia",
        description: "El archivo anterior permanece en el almacenamiento; la novedad usará el nuevo al guardar.",
        confirmText: "Reemplazar",
        cancelText: "Cancelar",
      })
      if (!confirmed) return
    }

    setUploading(true)
    setFormError(null)
    try {
      const uploaded = await uploadMedia(file)
      changeDraft({
        media_file_id: uploaded.id,
        media_url: uploaded.url,
        media_type: uploaded.media_type,
      })
      toast.success("Multimedia cargada. Guarda la novedad para asociarla.")
    } catch (error) {
      const message = errorMessage(error, "No se pudo subir la multimedia.")
      setFormError(message)
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const removeEditorMedia = async () => {
    if (!draft?.media_file_id) return

    const confirmed = await prompt({
      title: "Quitar multimedia",
      description: "La novedad perderá el vínculo con el archivo cuando guardes. El archivo no se borra del almacenamiento.",
      confirmText: "Quitar",
      cancelText: "Cancelar",
      variant: "danger",
    })
    if (!confirmed) return

    changeDraft({ media_file_id: null, media_url: null, media_type: null })
  }

  const save = async () => {
    if (!draft) return

    if (draft.title.trim().length < 2) {
      setFormError("El título en español debe tener al menos 2 caracteres.")
      return
    }
    if (!isValidSlug(draft.slug)) {
      setFormError("El slug debe usar minúsculas, números y guiones, sin espacios.")
      return
    }

    const issues = draft.status === "published" ? publishIssues(draft) : []
    if (issues.length > 0) {
      setFormError(`No se puede publicar: falta ${issues.join(", ")}.`)
      return
    }

    const current = editingId ? events.find((event) => event.id === editingId) : null
    const statusChanged = current ? current.status !== draft.status : draft.status !== "draft"
    if (statusChanged && ["published", "archived", "cancelled"].includes(draft.status)) {
      const confirmation =
        draft.status === "published"
          ? {
              title: "Publicar novedad",
              description:
                "La novedad se publicará y aparecerá en el carrusel si su ventana está vigente y tiene multimedia.",
              confirmText: "Publicar",
            }
          : draft.status === "archived"
            ? {
                title: "Archivar novedad",
                description: "La novedad se archivará y dejará de mostrarse en Store.",
                confirmText: "Archivar",
              }
            : {
                title: "Cancelar novedad",
                description: "La novedad quedará cancelada y dejará de mostrarse en Store.",
                confirmText: "Cancelar novedad",
              }
      const confirmed = await prompt({ ...confirmation, cancelText: "Volver" })
      if (!confirmed) return
    }

    setSaving(true)
    setFormError(null)
    try {
      const payload = draftPayload(draft)
      if (editingId) {
        await adminRequest(`/admin/jovy/events/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
      } else {
        await adminRequest("/admin/jovy/events", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      toast.success(editingId ? "Novedad actualizada." : "Novedad creada.")
      closeEditor()
      await load()
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar la novedad.")
      setFormError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4" data-jovy-quality data-testid="jovy-novelties-page">
      <Container className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1" className="jovy-title">Novedades</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Carrusel horizontal de Store. Cada novedad reutiliza el evento de Eventos Jovy: aquí se administran la
              multimedia, la vigencia, el orden y la visibilidad.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="small" onClick={openCreate}>
              Nueva novedad
            </Button>
            <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
              Actualizar
            </Button>
            <Button asChild size="small" variant="secondary">
              <a href="/app/jovy-herramientas/events">Abrir Eventos Jovy</a>
            </Button>
          </div>
        </div>

        {/* Dos cifras bastan para situar la bandeja: el desglose por estado ya
            vive en la insignia de cada tarjeta y en los filtros. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge color="purple">
            {events.length} {events.length === 1 ? "novedad" : "novedades"}
          </Badge>
          <Badge color="green">
            {storeVisibleCount} {storeVisibleCount === 1 ? "visible ahora" : "visibles ahora"}
          </Badge>
        </div>

        {loadError && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Text size="small" role="alert" className="text-ui-fg-error">
              {loadError}
            </Text>
            <Button size="small" variant="secondary" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        )}
        {sideWarning && (
          <Text size="small" role="status" className="text-ui-fg-subtle mt-3">
            {sideWarning}
          </Text>
        )}
        {actionError && (
          <Text size="small" role="alert" className="text-ui-fg-error mt-3">
            {actionError}
          </Text>
        )}
      </Container>

      {editorOpen && draft && (
        <NoveltyForm
          draft={draft}
          editing={editingId ? events.find((event) => event.id === editingId) ?? null : null}
          eventTypes={eventTypes}
          uploading={uploading}
          saving={saving}
          error={formError}
          onChange={changeDraft}
          onUpload={(file) => void uploadEditorMedia(file)}
          onRemoveMedia={() => void removeEditorMedia()}
          onSave={() => void save()}
          onCancel={closeEditor}
        />
      )}

      <Container className="p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            <label htmlFor="novelty-search" className="text-ui-fg-subtle text-xs font-medium">
              Buscar novedad
            </label>
            <Input
              id="novelty-search"
              type="search"
              placeholder="Título, título EN o slug"
              value={filters.search}
              onChange={(changeEvent) =>
                setFilters((current) => ({ ...current, search: changeEvent.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="novelty-status-filter" className="text-ui-fg-subtle text-xs font-medium">
              Estado
            </label>
            <select
              id="novelty-status-filter"
              className="border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive w-full rounded-md border px-2 py-1.5 text-sm outline-hidden focus-visible:ring-2"
              value={filters.status}
              onChange={(changeEvent) =>
                setFilters((current) => ({
                  ...current,
                  status: changeEvent.target.value as NoveltyFilters["status"],
                }))
              }
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="novelty-media-filter" className="text-ui-fg-subtle text-xs font-medium">
              Tipo de medio
            </label>
            <select
              id="novelty-media-filter"
              className="border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive w-full rounded-md border px-2 py-1.5 text-sm outline-hidden focus-visible:ring-2"
              value={filters.media}
              onChange={(changeEvent) =>
                setFilters((current) => ({
                  ...current,
                  media: changeEvent.target.value as NoveltyFilters["media"],
                }))
              }
            >
              {mediaFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="novelty-active-filter" className="text-ui-fg-subtle text-xs font-medium">
              Actividad
            </label>
            <select
              id="novelty-active-filter"
              className="border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive w-full rounded-md border px-2 py-1.5 text-sm outline-hidden focus-visible:ring-2"
              value={filters.active}
              onChange={(changeEvent) =>
                setFilters((current) => ({
                  ...current,
                  active: changeEvent.target.value as NoveltyFilters["active"],
                }))
              }
            >
              {activeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {filtersActive && (
            <Button size="small" variant="secondary" onClick={() => setFilters(emptyFilters())}>
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Text size="small" role="status" className="text-ui-fg-subtle">
            Mostrando {filtered.length} de {events.length} novedades.
          </Text>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Orden de Store: prioridad descendente y después orden ascendente. Reordenar se desactiva con filtros activos.
          </Text>
        </div>
      </Container>

      {loading && events.length === 0 ? (
        <Container className="p-6">
          <Text className="text-ui-fg-subtle" role="status">
            Cargando novedades…
          </Text>
        </Container>
      ) : events.length === 0 ? (
        <Container className="p-6">
          <Heading level="h2" className="jovy-subtitle">Todavía no hay novedades</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Crea la primera novedad con su multimedia para que aparezca en el carrusel de Store.
          </Text>
          <Button className="mt-4" size="small" onClick={openCreate}>
            Crear la primera novedad
          </Button>
        </Container>
      ) : filtered.length === 0 ? (
        <Container className="p-6">
          <Heading level="h2" className="jovy-subtitle">Ninguna novedad coincide</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Ajusta la búsqueda o limpia los filtros para volver al orden completo del carrusel.
          </Text>
          <Button className="mt-4" size="small" variant="secondary" onClick={() => setFilters(emptyFilters())}>
            Limpiar filtros
          </Button>
        </Container>
      ) : (
        <section
          aria-label="Novedades del carrusel"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* Encabezado real de la sección: evita saltar de h1 a los h3 de cada
              tarjeta sin añadir ruido visual. */}
          <h2 className="sr-only">Novedades del carrusel</h2>
          {filtered.map((event) => (
            <NoveltyCard
              key={event.id}
              event={event}
              position={events.findIndex((item) => item.id === event.id) + 1}
              store={noveltyStoreState(event)}
              filtersActive={filtersActive}
              canMoveUp={!filtersActive && !reordering && canMoveEventWithinPriority(events, event.id, -1)}
              canMoveDown={!filtersActive && !reordering && canMoveEventWithinPriority(events, event.id, 1)}
              busy={busyId === event.id}
              highlighted={highlightedId === event.id || editingId === event.id}
              onEdit={() => openEditor(event)}
              onMove={(direction) => void move(event, direction)}
              onSaveOrder={(order) => void saveOrder(event, order)}
              onToggleEnabled={() => void toggleEnabled(event)}
              onPublish={() => void publish(event)}
              onArchive={() => void archive(event)}
              onDelete={() => void deleteEvent(event)}
              onReplaceMedia={(file) => void replaceCardMedia(event, file)}
              onRemoveMedia={() => void removeMedia(event)}
            />
          ))}
        </section>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "Novedades", icon: Images, rank: 7 })
export default NoveltiesPage
