import {
  MagnifyingGlass,
  Photo,
  PlusMini,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Skeleton,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import {
  bannerPayload,
  changeBannerStatus,
  createBanner,
  deleteBanner,
  fetchBannerMediaUrl,
  fetchBanners,
  reorderBanners,
  updateBanner,
} from "../api"
import {
  initialSlotFilter,
  labelClass,
  priorityLabel,
  selectClass,
  windowState,
  type Banner,
  type BannerDraft,
  type Slot,
  type SlotFilter,
  type Status,
  type StatusFilter,
} from "../types"
import { BannerCard } from "./banner-card"
import { BannerForm } from "./banner-form"
import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"

/**
 * Administración de los anuncios de portada: `promo` es el modal de entrada y
 * `hint` el banner fijo bajo el logo. Es el único CRUD de los dos tipos: Anuncios
 * de portada monta este mismo componente y Marketing ya no lo embebe.
 * Reutiliza los endpoints existentes `/admin/jovy/marketing/banners`: no hay
 * endpoints nuevos.
 *
 * Diferencia pendiente con el administrador histórico: el recorte interactivo
 * (`crop_zoom`, `crop_offset_x`, `crop_offset_y`, `original_src`) no existe en
 * el backend de Medusa. Solo se persiste `media_file_id`; la imagen se sube ya
 * recortada y la UI lo declara explícitamente, sin simular el ajuste.
 */

export type BannerManagerProps = {
  initialSlot?: Slot
  headingLevel?: "h1" | "h2" | "h3"
  heading?: string
  /** Slot preseleccionado en el filtro; sin él la URL decide y por defecto se ven todos. */
  defaultSlotFilter?: SlotFilter
  /**
   * Copia explicativa del gestor (descripción de slots y nota de prioridad).
   * El anfitrión embebido la oculta cuando su propia sección ya explica el bloque.
   */
  showDescription?: boolean
  /**
   * Muestra el selector «¿Dónde aparece?». Al ocultarlo el listado queda fijado
   * al slot de `defaultSlotFilter`.
   */
  showSlotFilter?: boolean
  /** Oculta las insignias de conteo (`banner-stat-*`) en modo embebido. */
  showStats?: boolean
  /** Nivel del título interno del listado para no competir con el `h2` del anfitrión. */
  listHeadingLevel?: "h2" | "h3"
  /** Se invoca después de crear, editar, publicar, archivar, reordenar o eliminar. */
  onBannersChange?: () => void
}

export const BannerManager = ({
  initialSlot = "promo",
  headingLevel = "h1",
  heading = "Banners y anuncios",
  defaultSlotFilter,
  showDescription = true,
  showSlotFilter = true,
  showStats = true,
  listHeadingLevel = "h2",
  onBannersChange,
}: BannerManagerProps = {}) => {
  const prompt = usePrompt()
  const permissions = useJovyPermissions()
  const canCreate = permissions.can("jovy_announcements", "create")
  const canUpdate = permissions.can("jovy_announcements", "update")
  const canDelete = permissions.can("jovy_announcements", "delete")
  const canPublish = permissions.can("jovy_announcements", "publish")
  const canArchive = permissions.can("jovy_announcements", "archive")
  const [items, setItems] = useState<Banner[]>([])
  const [mediaUrls, setMediaUrls] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<"list" | "form">("list")
  const [editing, setEditing] = useState<Banner | null>(null)
  const [formVersion, setFormVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [query, setQuery] = useState("")
  const [slotFilter, setSlotFilter] = useState<SlotFilter>(() => defaultSlotFilter ?? initialSlotFilter())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const resolveMedia = useCallback(async (banners: Banner[]) => {
    const ids = Array.from(
      new Set(banners.map((banner) => banner.media_file_id).filter((id): id is string => Boolean(id))),
    )
    if (ids.length === 0) return

    const resolved = await Promise.all(
      ids.map(async (id) => {
        try {
          const url = await fetchBannerMediaUrl(id)
          return [id, url] as const
        } catch {
          return [id, null] as const
        }
      }),
    )
    setMediaUrls((current) => ({ ...current, ...Object.fromEntries(resolved) }))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const banners = await fetchBanners()
      setItems(banners)
      setLoadError(null)
      void resolveMedia(banners)
    } catch (error) {
      setLoadError(errorMessage(error, "No fue posible cargar los banners."))
    } finally {
      setLoading(false)
    }
  }, [resolveMedia])

  useEffect(() => {
    void load()
  }, [load])

  const startCreate = () => {
    setEditing(null)
    setFormError(null)
    setFormVersion((version) => version + 1)
    setView("form")
  }

  const startEdit = (banner: Banner) => {
    setEditing(banner)
    setFormError(null)
    setFormVersion((version) => version + 1)
    setView("form")
  }

  const returnToList = () => {
    setEditing(null)
    setFormError(null)
    setView("list")
  }

  const save = async (draft: BannerDraft) => {
    setSaving(true)
    setFormError(null)
    try {
      await (editing ? updateBanner(editing.id, bannerPayload(draft)) : createBanner(draft))

      toast.success(editing ? "Banner actualizado." : "Banner creado.")
      returnToList()
      await load()
      onBannersChange?.()
    } catch (error) {
      setFormError(errorMessage(error, "No se pudo guardar el banner."))
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (banner: Banner, next: Status) => {
    const actionLabel =
      next === "published" ? "Publicar" : next === "archived" ? "Archivar" : "Despublicar"
    const confirmed = await prompt({
      variant: next === "archived" ? "danger" : "confirmation",
      title: `${actionLabel} banner`,
      description:
        next === "published"
          ? `«${banner.translations.es.title}» pasará a publicado. Solo se mostrará en Store si está habilitado y dentro de su ventana de fechas.`
          : next === "archived"
            ? `«${banner.translations.es.title}» quedará archivado y dejará de mostrarse en Store.`
            : `«${banner.translations.es.title}» volverá a borrador y dejará de mostrarse en Store.`,
      confirmText: `${actionLabel} banner`,
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setBusyId(banner.id)
    try {
      await changeBannerStatus(banner.id, next)
      toast.success(
        next === "published"
          ? "Banner publicado."
          : next === "archived"
            ? "Banner archivado."
            : "Banner despublicado.",
      )
      await load()
      onBannersChange?.()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo actualizar el estado del banner."))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (banner: Banner) => {
    const confirmed = await prompt({
      variant: "danger",
      title: "Eliminar banner",
      description: `Se eliminará definitivamente «${banner.translations.es.title}». El archivo de imagen queda en el File Module porque no existe endpoint de borrado de medios.`,
      confirmText: "Eliminar banner",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setBusyId(banner.id)
    try {
      await deleteBanner(banner.id)
      toast.success("Banner eliminado.")
      await load()
      onBannersChange?.()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo eliminar el banner."))
    } finally {
      setBusyId(null)
    }
  }

  const term = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      items.filter((banner) => {
        if (slotFilter !== "all" && banner.slot !== slotFilter) return false
        if (statusFilter !== "all" && banner.status !== statusFilter) return false
        if (!term) return true
        const haystack = [
          banner.translations.es.title,
          banner.translations.en.title,
          banner.translations.es.alt,
          banner.translations.en.alt,
          banner.cta_url ?? "",
          banner.id,
        ]
          .join(" ")
          .toLowerCase()
        return haystack.includes(term)
      }),
    [items, slotFilter, statusFilter, term],
  )

  /**
   * Mueve el banner dentro de la vista filtrada. Con la misma prioridad alcanza
   * con reordenar `sort_order`, pero la prioridad manda sobre él, así que mover
   * un banner sobre otro de prioridad distinta exige intercambiar prioridades;
   * el prompt lo declara antes de mutar nada.
   */
  const move = async (banner: Banner, direction: -1 | 1) => {
    const position = filtered.findIndex((item) => item.id === banner.id)
    const target = position + direction
    if (reordering || position < 0 || target < 0 || target >= filtered.length) return
    const destination = filtered[target]

    if (destination.priority !== banner.priority) {
      const confirmed = await prompt({
        variant: "confirmation",
        title: "Intercambiar prioridades",
        description: `«${banner.translations.es.title}» pasará a prioridad ${priorityLabel(destination.priority)} y «${destination.translations.es.title}» a ${priorityLabel(banner.priority)}. La prioridad manda sobre el orden de la vista, así que se intercambian para que el movimiento se note.`,
        confirmText: "Intercambiar prioridades",
        cancelText: "Cancelar",
      })
      if (!confirmed) return

      setReordering(true)
      try {
        await updateBanner(banner.id, { priority: destination.priority })
        await updateBanner(destination.id, { priority: banner.priority })
        toast.success("Prioridades intercambiadas y orden actualizado.")
        onBannersChange?.()
      } catch (error) {
        toast.error(errorMessage(error, "No se pudo intercambiar la prioridad de los banners."))
      } finally {
        // El primer PUT pudo aplicarse antes del fallo: recargar deja la vista
        // igual que el estado guardado en ambos casos.
        await load()
        setReordering(false)
      }
      return
    }

    // Solo se mueve la subsecuencia visible: los banners ocultos por los filtros
    // conservan su sitio en el array global que se envía al endpoint.
    const visibleIds = filtered.map((item) => item.id)
    ;[visibleIds[position], visibleIds[target]] = [visibleIds[target], visibleIds[position]]
    const visibleSet = new Set(visibleIds)
    let nextVisible = 0
    const ids = items.map((item) =>
      visibleSet.has(item.id) ? visibleIds[nextVisible++] : item.id,
    )

    setReordering(true)
    try {
      await reorderBanners(ids)
      toast.success("Orden de banners actualizado.")
      await load()
      onBannersChange?.()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo reordenar los banners."))
    } finally {
      setReordering(false)
    }
  }

  const now = Date.now()
  const stats = useMemo(
    () => ({
      total: items.length,
      published: items.filter((banner) => banner.status === "published").length,
      active: items.filter((banner) => windowState(banner) === "active").length,
      scheduled: items.filter((banner) => windowState(banner) === "scheduled").length,
    }),
    [items],
  )

  // Un slot fijado por el anfitrión (selector oculto) no cuenta como filtro
  // activo: si no, «Limpiar filtros» aparecería desde el primer render.
  const pinnedSlot = showSlotFilter ? "all" : (defaultSlotFilter ?? "all")
  const filtersActive =
    (showSlotFilter && slotFilter !== "all") || statusFilter !== "all" || term.length > 0
  const clearFilters = () => {
    setQuery("")
    setSlotFilter(pinnedSlot)
    setStatusFilter("all")
  }

  const headerActions = (
    <>
      <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
        Actualizar
      </Button>
      {canCreate && (
        <Button size="small" onClick={startCreate}>
          <PlusMini />
          Nuevo banner
        </Button>
      )}
    </>
  )

  if (view === "form") {
    return (
      <BannerForm
        key={`${editing?.id ?? "new"}-${formVersion}`}
        initial={editing}
        defaultSlot={slotFilter !== "all" ? slotFilter : initialSlot}
        saving={saving}
        error={formError}
        onCancel={returnToList}
        onSubmit={(draft) => void save(draft)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-y-4" data-testid="banner-manager">
      {heading.trim() !== "" || showDescription ? (
        <Container className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {/* El anfitrión puede ocultar el título (`heading=""`) cuando su sección ya titula el bloque. */}
              {heading.trim() !== "" && <Heading level={headingLevel}>{heading}</Heading>}
              {showDescription && (
                <Text size="small" className="text-ui-fg-subtle mt-1">
                  Dos tipos de anuncio: el banner fijo bajo el logo y el modal de entrada. La
                  frecuencia y la apertura automática solo aplican al modal.
                </Text>
              )}
            </div>
            <div className="flex flex-wrap gap-2">{headerActions}</div>
          </div>
          {loadError && (
            <p role="alert" className="text-ui-fg-error mt-3 text-sm">
              {loadError}
            </p>
          )}
        </Container>
      ) : (
        // Sin título ni descripción (modo embebido) el `Container` quedaría vacío:
        // las acciones pasan a una fila compacta justo encima de los filtros.
        <>
          {loadError && (
            <p role="alert" className="text-ui-fg-error text-sm">
              {loadError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">{headerActions}</div>
        </>
      )}

      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-y-1">
            <label htmlFor="banner-search" className={labelClass}>
              Buscar banners
            </label>
            <div className="relative">
              <MagnifyingGlass
                aria-hidden
                className="text-ui-fg-muted pointer-events-none absolute left-2.5 top-2.5 h-4 w-4"
              />
              <Input
                id="banner-search"
                value={query}
                className="pl-8"
                placeholder="Título, texto alternativo, CTA o id"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {showSlotFilter && (
            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-slot-filter" className={labelClass}>
                ¿Dónde aparece?
              </label>
              <select
                id="banner-slot-filter"
                aria-label="¿Dónde aparece?"
                className={selectClass}
                value={slotFilter}
                onChange={(event) => setSlotFilter(event.target.value as SlotFilter)}
              >
                <option value="all">Todos</option>
                <option value="hint">Bajo el logo</option>
                <option value="promo">Modal de entrada</option>
              </select>
            </div>
          )}

          <div className="flex flex-col gap-y-1">
            <label htmlFor="banner-status-filter" className={labelClass}>
              Filtro por estado
            </label>
            <select
              id="banner-status-filter"
              aria-label="Filtro por estado"
              className={selectClass}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          {filtersActive && (
            <Button size="small" variant="secondary" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>

        <Text size="xsmall" className="text-ui-fg-subtle mt-3">
          Subir/Bajar reordena la vista; si cambia de prioridad, se intercambian las prioridades.
        </Text>

        {showStats && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge size="small" color="grey" data-testid="banner-stat-total">
              Total {stats.total}
            </Badge>
            <Badge size="small" color="green" data-testid="banner-stat-published">
              Publicados {stats.published}
            </Badge>
            <Badge size="small" color="blue" data-testid="banner-stat-active">
              Activos ahora {stats.active}
            </Badge>
            <Badge size="small" color="purple" data-testid="banner-stat-scheduled">
              Programados {stats.scheduled}
            </Badge>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {filtersActive ? `${filtered.length} de ${items.length} visibles` : "Sin filtros activos"}
            </Text>
          </div>
        )}

        {showDescription && (
          <Text size="xsmall" className="text-ui-fg-subtle mt-2">
            La prioridad más alta se muestra primero en el storefront. Subir/Bajar mueve el banner
            dentro de la vista; si el banner de al lado tiene otra prioridad, se intercambian.
          </Text>
        )}
      </Container>

      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Heading level={listHeadingLevel}>Banners</Heading>
          {!loading && (
            <Text size="small" className="text-ui-fg-subtle">
              {filtered.length} de {items.length}
            </Text>
          )}
        </div>

        {loading ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status">
            <span className="sr-only">Cargando banners…</span>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-3 rounded-lg border p-3"
              >
                <Skeleton className="aspect-[16/10] w-full rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="border-ui-border-base mt-4 rounded-lg border border-dashed p-8 text-center">
            <Photo aria-hidden className="text-ui-fg-muted mx-auto h-8 w-8" />
            <Text className="mt-3">Aún no hay banners.</Text>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Crea el primero para el modal de entrada o para el banner bajo el logo.
            </Text>
            <Button className="mt-4" size="small" onClick={startCreate} disabled={!canCreate}>
              Crear el primer banner
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-ui-border-base mt-4 rounded-lg border border-dashed p-8 text-center">
            <Text>No hay banners con estos filtros.</Text>
            <Button className="mt-4" size="small" variant="secondary" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <ul
            className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Banners"
          >
            {filtered.map((banner) => {
              const state = windowState(banner, now)
              const imageUrl = banner.media_file_id ? mediaUrls[banner.media_file_id] : null
              const position = filtered.findIndex((item) => item.id === banner.id)

              return (
                <BannerCard
                  key={banner.id}
                  banner={banner}
                  imageUrl={imageUrl}
                  state={state}
                  busy={busyId === banner.id}
                  reordering={reordering}
                  canMoveUp={position > 0}
                  canMoveDown={position >= 0 && position < filtered.length - 1}
                  onEdit={startEdit}
                  onChangeStatus={(item, next) => void changeStatus(item, next)}
                  onMove={(item, direction) => void move(item, direction)}
                  onRemove={(item) => void remove(item)}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  canPublish={canPublish}
                  canArchive={canArchive}
                />
              )
            })}
          </ul>
        )}
      </Container>
    </div>
  )
}
