import {
  ExclamationCircle,
  MagnifyingGlass,
  PencilSquare,
  Photo,
  PlusMini,
} from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  DropdownMenu,
  Heading,
  Input,
  Skeleton,
  Switch,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { marketingApi, toDateTimeLocal, toIso } from "./admin-api"

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

type Status = "draft" | "published" | "archived"
type Slot = "promo" | "hint"
type Frequency = "every" | "session" | "daily" | "once"

type LocalizedBannerContent = {
  title: string
  description?: string
  cta_label?: string
  alt: string
}

type Banner = {
  id: string
  slot: Slot
  status: Status
  enabled: boolean
  auto_open: boolean
  frequency: Frequency
  rotation_seconds: number
  priority: number
  sort_order: number
  media_file_id: string | null
  cta_url: string | null
  starts_at: string | null
  ends_at: string | null
  translations: {
    es: LocalizedBannerContent
    en: LocalizedBannerContent
  }
}

type BannerDraft = Omit<Banner, "id">

type SlotFilter = "all" | Slot
type StatusFilter = "all" | Status

type WindowState = "active" | "scheduled" | "expired" | "inactive"

const SLOT_LABEL: Record<Slot, string> = {
  promo: "Modal de entrada",
  hint: "Bajo el logo",
}

const STATUS_LABEL: Record<Status, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
}

const STATUS_COLOR: Record<Status, "green" | "orange" | "grey"> = {
  draft: "orange",
  published: "green",
  archived: "grey",
}

const FREQUENCY_LABEL: Record<Frequency, string> = {
  every: "Cada recarga completa",
  session: "Una vez por sesión",
  daily: "Una vez al día",
  once: "Una vez por navegador",
}

const WINDOW_LABEL: Record<WindowState, string> = {
  active: "Activo ahora",
  scheduled: "Programado",
  expired: "Vencido",
  inactive: "Inactivo",
}

const WINDOW_COLOR: Record<WindowState, "green" | "blue" | "orange" | "grey"> = {
  active: "green",
  scheduled: "blue",
  expired: "orange",
  inactive: "grey",
}

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp"
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const TITLE_MAX = 180
const DESCRIPTION_MAX = 2_000
const CTA_LABEL_MAX = 80
const ALT_MAX = 255
const CTA_URL_MAX = 500
const PRIORITY_MAX = 1_000

// Duración en pantalla de cada anuncio cuando el lugar tiene más de uno.
const ROTATION_MIN = 3
const ROTATION_MAX = 60
const ROTATION_DEFAULT = 8
const ROTATION_PRESETS = [5, 8, 10, 15, 30]

const labelClass = "text-ui-fg-subtle text-xs font-medium"
const selectClass =
  "border-ui-border-base bg-ui-bg-base h-8 rounded-md px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-interactive"

const emptyBanner = (slot: Slot = "promo"): BannerDraft => ({
  slot,
  status: "draft",
  enabled: true,
  // La auto-apertura es opt-in: el backend la guarda en `false` por defecto y
  // el modal debe abrirse solo cuando la persona administradora lo decide.
  auto_open: false,
  frequency: "every",
  rotation_seconds: ROTATION_DEFAULT,
  priority: 0,
  sort_order: 0,
  media_file_id: null,
  cta_url: null,
  starts_at: null,
  ends_at: null,
  translations: {
    es: { title: "", description: "", cta_label: "", alt: "" },
    en: { title: "", description: "", cta_label: "", alt: "" },
  },
})

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "short",
})

function formatDate(value: string | null) {
  if (!value) return "Sin límite"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Fecha inválida" : dateFormatter.format(date)
}

/**
 * Vigencia en una línea: sin fechas el anuncio permanece hasta desactivarlo.
 * `formatDate` puede cerrar ya con punto por el sufijo «a.m.»/«p.m.» de `es-MX`,
 * así que la etiqueta garantiza un único punto final y quien la use no añade otro.
 */
function vigenciaLabel(banner: Pick<Banner, "starts_at" | "ends_at">) {
  const label =
    !banner.starts_at && !banner.ends_at
      ? "Permanente"
      : !banner.ends_at
        ? `Desde ${formatDate(banner.starts_at)}`
        : !banner.starts_at
          ? `Hasta ${formatDate(banner.ends_at)}`
          : `Del ${formatDate(banner.starts_at)} al ${formatDate(banner.ends_at)}`

  return label.endsWith(".") ? label : `${label}.`
}

/**
 * Estado real del banner frente a la ventana de publicación. Un borrador con
 * fecha futura no está "programado": solo se programa lo publicado y habilitado.
 */
function windowState(banner: Pick<Banner, "status" | "enabled" | "starts_at" | "ends_at">, now = Date.now()): WindowState {
  if (banner.status !== "published" || !banner.enabled) return "inactive"
  const start = banner.starts_at ? new Date(banner.starts_at).getTime() : null
  const end = banner.ends_at ? new Date(banner.ends_at).getTime() : null
  if (start !== null && Number.isFinite(start) && now < start) return "scheduled"
  if (end !== null && Number.isFinite(end) && now > end) return "expired"
  return "active"
}

function draftFromBanner(banner: Banner): BannerDraft {
  return {
    slot: banner.slot,
    status: banner.status,
    enabled: banner.enabled,
    auto_open: banner.auto_open,
    frequency: banner.frequency,
    rotation_seconds: banner.rotation_seconds ?? ROTATION_DEFAULT,
    priority: banner.priority,
    sort_order: banner.sort_order,
    media_file_id: banner.media_file_id,
    cta_url: banner.cta_url,
    starts_at: banner.starts_at,
    ends_at: banner.ends_at,
    translations: {
      es: { ...banner.translations.es },
      en: { ...banner.translations.en },
    },
  }
}

function priorityLabel(priority: number) {
  if (priority >= 2) return "Alta"
  if (priority === 1) return "Media"
  return "Baja"
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** El Admin es una SPA: el parámetro `slot` de la URL abre el gestor filtrado. */
function initialSlotFilter(): SlotFilter {
  if (typeof window === "undefined") return "all"
  const slot = new URLSearchParams(window.location.search).get("slot")
  return slot === "promo" || slot === "hint" ? slot : "all"
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
}: {
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
} = {}) => {
  const prompt = usePrompt()
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
          const result = await marketingApi<{ file: { url: string } }>(`/admin/jovy/marketing/media/${id}`)
          return [id, result.file.url] as const
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
      const result = await marketingApi<{ banners: Banner[] }>("/admin/jovy/marketing/banners")
      setItems(result.banners)
      setLoadError(null)
      void resolveMedia(result.banners)
    } catch (error) {
      setLoadError(errorText(error, "No fue posible cargar los banners."))
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
      const payload = {
        slot: draft.slot,
        translations: {
          es: {
            title: draft.translations.es.title.trim(),
            description: draft.translations.es.description?.trim() || undefined,
            cta_label: draft.translations.es.cta_label?.trim() || undefined,
            alt: draft.translations.es.alt.trim(),
          },
          en: {
            title: draft.translations.en.title.trim(),
            description: draft.translations.en.description?.trim() || undefined,
            cta_label: draft.translations.en.cta_label?.trim() || undefined,
            alt: draft.translations.en.alt.trim(),
          },
        },
        status: draft.status,
        enabled: draft.enabled,
        auto_open: draft.auto_open,
        frequency: draft.frequency,
        rotation_seconds: draft.rotation_seconds,
        priority: draft.priority,
        sort_order: draft.sort_order,
        media_file_id: draft.media_file_id || null,
        cta_url: draft.cta_url?.trim() || null,
        starts_at: draft.starts_at,
        ends_at: draft.ends_at,
      }

      await (editing
        ? marketingApi(`/admin/jovy/marketing/banners/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : marketingApi("/admin/jovy/marketing/banners", {
            method: "POST",
            body: JSON.stringify(payload),
          }))

      toast.success(editing ? "Banner actualizado." : "Banner creado.")
      returnToList()
      await load()
      onBannersChange?.()
    } catch (error) {
      setFormError(errorText(error, "No se pudo guardar el banner."))
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
      await marketingApi(`/admin/jovy/marketing/banners/${banner.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      })
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
      toast.error(errorText(error, "No se pudo actualizar el estado del banner."))
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
      await marketingApi(`/admin/jovy/marketing/banners/${banner.id}`, { method: "DELETE" })
      toast.success("Banner eliminado.")
      await load()
      onBannersChange?.()
    } catch (error) {
      toast.error(errorText(error, "No se pudo eliminar el banner."))
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
        await marketingApi(`/admin/jovy/marketing/banners/${banner.id}`, {
          method: "PUT",
          body: JSON.stringify({ priority: destination.priority }),
        })
        await marketingApi(`/admin/jovy/marketing/banners/${destination.id}`, {
          method: "PUT",
          body: JSON.stringify({ priority: banner.priority }),
        })
        toast.success("Prioridades intercambiadas y orden actualizado.")
        onBannersChange?.()
      } catch (error) {
        toast.error(errorText(error, "No se pudo intercambiar la prioridad de los banners."))
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
      await marketingApi("/admin/jovy/marketing/banners/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      })
      toast.success("Orden de banners actualizado.")
      await load()
      onBannersChange?.()
    } catch (error) {
      toast.error(errorText(error, "No se pudo reordenar los banners."))
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
      <Button size="small" onClick={startCreate}>
        <PlusMini />
        Nuevo banner
      </Button>
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
            <Button className="mt-4" size="small" onClick={startCreate}>
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
              const title = banner.translations.es.title
              const imageUrl = banner.media_file_id ? mediaUrls[banner.media_file_id] : null
              const position = filtered.findIndex((item) => item.id === banner.id)
              const busy = busyId === banner.id
              const canMoveUp = position > 0
              const canMoveDown = position >= 0 && position < filtered.length - 1

              return (
                <li
                  key={banner.id}
                  data-testid={`banner-card-${banner.id}`}
                  className="jovy-container flex min-w-0 flex-col rounded-md border border-ui-border-base bg-ui-bg-base p-3 shadow-elevation-card-rest"
                >
                  <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded bg-ui-bg-subtle">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={`Vista previa de ${title}`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 p-4 text-center">
                        <Photo aria-hidden className="text-ui-fg-muted h-6 w-6" />
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {banner.media_file_id ? "Imagen no disponible" : "Sin imagen"}
                        </Text>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge color={banner.slot === "promo" ? "purple" : "blue"}>
                        {SLOT_LABEL[banner.slot]}
                      </Badge>
                      <Badge color={STATUS_COLOR[banner.status]}>
                        {STATUS_LABEL[banner.status]}
                      </Badge>
                      <Badge color={WINDOW_COLOR[state]} data-testid={`banner-window-${banner.id}`}>
                        {WINDOW_LABEL[state]}
                      </Badge>
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{title || "Sin título"}</h3>
                      <Text size="xsmall" className="text-ui-fg-subtle line-clamp-1">
                        {banner.translations.en.title || "Sin título EN"}
                      </Text>
                    </div>

                    {banner.translations.es.description && (
                      <Text size="small" className="text-ui-fg-subtle line-clamp-2">
                        {banner.translations.es.description}
                      </Text>
                    )}

                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {`Prioridad ${banner.priority} (${priorityLabel(banner.priority)}) · Orden ${banner.sort_order} · ${vigenciaLabel(banner)}`}
                    </Text>

                    <details className="jovy-card-details">
                      <summary className="text-ui-fg-subtle w-fit cursor-pointer text-xs">Detalles</summary>
                      <dl className="text-ui-fg-subtle mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div className="col-span-2">
                          <dt className="inline">Duración: </dt>
                          <dd className="inline font-medium">{banner.rotation_seconds ?? ROTATION_DEFAULT} s</dd>
                        </div>
                        {banner.slot === "promo" && (
                          <div className="col-span-2">
                            <dt className="inline">Frecuencia: </dt>
                            <dd className="inline font-medium">{FREQUENCY_LABEL[banner.frequency]}</dd>
                          </div>
                        )}
                        <div className="col-span-2">
                          <dt className="inline">Ventana: </dt>
                          <dd className="inline font-medium">
                            {formatDate(banner.starts_at)} → {formatDate(banner.ends_at)}
                          </dd>
                        </div>
                        {banner.cta_url && (
                          <div className="col-span-2 min-w-0">
                            <dt className="inline">CTA: </dt>
                            <dd className="inline truncate font-mono">{banner.cta_url}</dd>
                          </div>
                        )}
                        {banner.slot === "promo" && (
                          <div>
                            <dt className="inline">Auto-apertura: </dt>
                            <dd className="inline font-medium">{banner.auto_open ? "Sí" : "No"}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="inline">Estado: </dt>
                          <dd className="inline font-medium">
                            {banner.enabled ? "Habilitado" : "Deshabilitado"}
                          </dd>
                        </div>
                      </dl>
                    </details>

                    <div className="jovy-actions jovy-actions--end-danger mt-auto flex flex-wrap gap-2 border-t border-ui-border-base pt-3">
                      <Button
                        size="small"
                        variant="secondary"
                        aria-label={`Editar ${title}`}
                        onClick={() => startEdit(banner)}
                        disabled={busy || reordering}
                      >
                        <PencilSquare />
                        Editar
                      </Button>

                      {banner.status === "published" ? (
                        <Button
                          size="small"
                          variant="secondary"
                          aria-label={`Despublicar ${title}`}
                          isLoading={busy}
                          disabled={busy || reordering}
                          onClick={() => void changeStatus(banner, "draft")}
                        >
                          Despublicar
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="secondary"
                          aria-label={`Publicar ${title}`}
                          isLoading={busy}
                          disabled={busy || reordering || banner.status === "archived"}
                          onClick={() => void changeStatus(banner, "published")}
                        >
                          Publicar
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <Button
                            size="small"
                            variant="secondary"
                            aria-label={`Más acciones para ${title}`}
                            data-testid={`banner-actions-${banner.id}`}
                            disabled={busy || reordering}
                          >
                            Más
                          </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item
                            aria-label={`Archivar ${title}`}
                            disabled={busy || reordering || banner.status === "archived"}
                            onSelect={() => void changeStatus(banner, "archived")}
                          >
                            Archivar
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            aria-label={`Subir ${title}`}
                            disabled={busy || reordering || !canMoveUp}
                            onSelect={() => void move(banner, -1)}
                          >
                            Subir
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            aria-label={`Bajar ${title}`}
                            disabled={busy || reordering || !canMoveDown}
                            onSelect={() => void move(banner, 1)}
                          >
                            Bajar
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            className="text-ui-fg-error"
                            aria-label={`Eliminar ${title}`}
                            disabled={busy || reordering}
                            onSelect={() => void remove(banner)}
                          >
                            Eliminar
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Container>
    </div>
  )
}

type FieldErrors = Partial<
  Record<
    | "esTitle"
    | "enTitle"
    | "esAlt"
    | "enAlt"
    | "esDescription"
    | "enDescription"
    | "esCtaLabel"
    | "enCtaLabel"
    | "ctaUrl"
    | "startsAt"
    | "endsAt"
    | "rotationSeconds"
    | "priority"
    | "sortOrder",
    string
  >
>

const FIELD_ORDER: Array<keyof FieldErrors> = [
  "esTitle",
  "enTitle",
  "esAlt",
  "enAlt",
  "esDescription",
  "enDescription",
  "esCtaLabel",
  "enCtaLabel",
  "ctaUrl",
  "startsAt",
  "endsAt",
  "rotationSeconds",
  "priority",
  "sortOrder",
]

const FIELD_ID: Record<keyof FieldErrors, string> = {
  esTitle: "banner-title-es",
  enTitle: "banner-title-en",
  esAlt: "banner-alt-es",
  enAlt: "banner-alt-en",
  esDescription: "banner-description-es",
  enDescription: "banner-description-en",
  esCtaLabel: "banner-cta-label-es",
  enCtaLabel: "banner-cta-label-en",
  ctaUrl: "banner-cta-url",
  startsAt: "banner-starts-at",
  endsAt: "banner-ends-at",
  rotationSeconds: "banner-rotation-seconds",
  priority: "banner-priority",
  sortOrder: "banner-sort-order",
}

function validateDraft(draft: BannerDraft): FieldErrors {
  const errors: FieldErrors = {}
  const es = draft.translations.es
  const en = draft.translations.en

  const validateContent = (
    value: LocalizedBannerContent,
    language: "es" | "en",
  ) => {
    const title = value.title.trim()
    const alt = value.alt.trim()
    if (title.length < 2) {
      errors[language === "es" ? "esTitle" : "enTitle"] =
        `El título en ${language === "es" ? "español" : "inglés"} debe tener al menos 2 caracteres.`
    } else if (title.length > TITLE_MAX) {
      errors[language === "es" ? "esTitle" : "enTitle"] = `El título no puede superar ${TITLE_MAX} caracteres.`
    }
    if (alt.length < 1) {
      errors[language === "es" ? "esAlt" : "enAlt"] =
        "El texto alternativo es obligatorio para accesibilidad."
    } else if (alt.length > ALT_MAX) {
      errors[language === "es" ? "esAlt" : "enAlt"] = `El texto alternativo no puede superar ${ALT_MAX} caracteres.`
    }
    if ((value.description ?? "").length > DESCRIPTION_MAX) {
      errors[language === "es" ? "esDescription" : "enDescription"] =
        `La descripción no puede superar ${DESCRIPTION_MAX} caracteres.`
    }
    if ((value.cta_label ?? "").length > CTA_LABEL_MAX) {
      errors[language === "es" ? "esCtaLabel" : "enCtaLabel"] =
        `La etiqueta del CTA no puede superar ${CTA_LABEL_MAX} caracteres.`
    }
  }

  validateContent(es, "es")
  validateContent(en, "en")

  const cta = draft.cta_url?.trim() ?? ""
  if (cta.length > CTA_URL_MAX) {
    errors.ctaUrl = `La URL del CTA no puede superar ${CTA_URL_MAX} caracteres.`
  } else if (cta && !cta.startsWith("/") && !cta.startsWith("https://")) {
    errors.ctaUrl = "Usa una ruta relativa que empiece con / o una URL que empiece con https://."
  }

  if (draft.starts_at && draft.ends_at) {
    const start = new Date(draft.starts_at).getTime()
    const end = new Date(draft.ends_at).getTime()
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      errors.endsAt = "La fecha de fin debe ser posterior a la fecha de inicio."
    }
  }

  if (!Number.isInteger(draft.priority) || draft.priority < 0 || draft.priority > PRIORITY_MAX) {
    errors.priority = `La prioridad debe ser un entero entre 0 y ${PRIORITY_MAX}.`
  }
  if (
    !Number.isInteger(draft.rotation_seconds) ||
    draft.rotation_seconds < ROTATION_MIN ||
    draft.rotation_seconds > ROTATION_MAX
  ) {
    errors.rotationSeconds = `La duración en pantalla debe ser un entero entre ${ROTATION_MIN} y ${ROTATION_MAX} segundos.`
  }
  if (!Number.isInteger(draft.sort_order) || draft.sort_order < 0) {
    errors.sortOrder = "El orden debe ser un entero mayor o igual a 0."
  }

  return errors
}

type BannerFormProps = {
  initial: Banner | null
  defaultSlot: Slot
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (draft: BannerDraft) => void
}

const BannerForm = ({ initial, defaultSlot, saving, error, onCancel, onSubmit }: BannerFormProps) => {
  const [draft, setDraft] = useState<BannerDraft>(() =>
    initial ? draftFromBanner(initial) : emptyBanner(defaultSlot),
  )
  const [attempted, setAttempted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [mediaReady, setMediaReady] = useState(false)

  useEffect(() => {
    let active = true
    const mediaId = initial?.media_file_id
    if (!mediaId) return () => { active = false }

    setMediaReady(false)
    marketingApi<{ file: { url: string } }>(`/admin/jovy/marketing/media/${mediaId}`)
      .then((result) => {
        if (!active) return
        setPreviewUrl(result.file.url)
        setPreviewError(null)
      })
      .catch(() => {
        if (!active) return
        setPreviewError("No fue posible recuperar la vista previa del archivo asociado.")
      })
      .finally(() => {
        if (active) setMediaReady(true)
      })

    return () => {
      active = false
    }
  }, [initial?.media_file_id])

  const errors = validateDraft(draft)
  const errorCount = Object.keys(errors).length
  const visibleErrors = attempted ? errors : {}

  const update = (patch: Partial<BannerDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const updateTranslation = (language: "es" | "en", patch: Partial<LocalizedBannerContent>) =>
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [language]: { ...current.translations[language], ...patch },
      },
    }))

  const upload = async (file?: File) => {
    if (!file) return
    setUploadError(null)

    if (!IMAGE_TYPES.includes(file.type)) {
      setUploadError("Solo se aceptan imágenes PNG, JPEG o WebP.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("La imagen supera el límite de 5 MB.")
      return
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.append("files", file)
      const result = await marketingApi<{ file: { id: string; url: string } }>(
        "/admin/jovy/marketing/media",
        { method: "POST", body },
      )
      update({ media_file_id: result.file.id })
      setPreviewUrl(result.file.url)
      setPreviewError(null)
    } catch (reason) {
      setUploadError(errorText(reason, "No se pudo cargar la imagen."))
    } finally {
      setUploading(false)
    }
  }

  const setSlot = (slot: Slot) => {
    // `auto_open` y `frequency` solo tienen sentido en el modal.
    setDraft((current) => ({
      ...current,
      slot,
      auto_open: slot === "promo" ? current.auto_open : false,
      frequency: slot === "promo" ? current.frequency : "every",
    }))
  }

  /**
   * Presets de vigencia. Escriben las mismas fechas locales que edita el
   * usuario (minuto exacto, como los inputs `datetime-local`).
   */
  const applyDatePreset = (days: number) => {
    const start = new Date()
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
    update({
      starts_at: toIso(toDateTimeLocal(start.toISOString())),
      ends_at: toIso(toDateTimeLocal(end.toISOString())),
    })
  }

  const submit = () => {
    if (uploading) return
    setAttempted(true)
    const currentErrors = validateDraft(draft)
    const firstError = FIELD_ORDER.find((field) => currentErrors[field])
    if (firstError) {
      document.getElementById(FIELD_ID[firstError])?.focus()
      return
    }
    onSubmit(draft)
  }

  const title = initial ? "Editar banner" : "Nuevo banner"

  return (
    <Container className="p-4 sm:p-6" data-testid="banner-form-panel">
      <div className="border-ui-border-base mb-6 flex flex-wrap items-start gap-3 border-b pb-4">
        <Button type="button" variant="transparent" size="small" onClick={onCancel} disabled={saving}>
          ← Volver a banners
        </Button>
        <div>
          <Heading level="h1">{title}</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Contenido bilingüe, multimedia, CTA, programación y prioridad. Publica cuando la ventana
            y los textos estén listos.
          </Text>
        </div>
      </div>

      <form
        id="banner-form"
        data-testid="banner-form"
        className="flex max-w-5xl flex-col gap-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {(error || (attempted && errorCount > 0)) && (
          <p role="alert" className="text-ui-fg-error text-sm">
            {error ??
              `Revisa ${errorCount === 1 ? "el campo marcado" : `los ${errorCount} campos marcados`} antes de guardar.`}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section
            aria-labelledby="banner-media-heading"
            className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-3 rounded-lg border p-4 sm:p-5"
          >
            <div>
              <Heading level="h2" id="banner-media-heading" className="text-base">
                Multimedia y vista previa
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                PNG, JPEG o WebP de hasta 5 MB. La imagen se muestra tal cual en el modal: no se
                recorta.
              </Text>
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-media" className={labelClass}>
                Imagen del banner
              </label>
              <Input
                id="banner-media"
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                disabled={uploading || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  void upload(file)
                  event.target.value = ""
                }}
              />
              {uploading && (
                <Text size="xsmall" className="text-ui-fg-subtle" role="status">
                  Subiendo imagen…
                </Text>
              )}
              {uploadError && (
                <Text size="small" role="alert" className="text-ui-fg-error">
                  {uploadError}
                </Text>
              )}
              {previewError && (
                <Text size="small" role="alert" className="text-ui-fg-error">
                  {previewError}
                </Text>
              )}
            </div>

            <div className="bg-ui-bg-subtle border-ui-border-base flex aspect-[16/10] items-center justify-center overflow-hidden rounded-md border">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Vista previa del banner"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 p-4 text-center">
                  <Photo aria-hidden className="text-ui-fg-muted h-7 w-7" />
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {draft.media_file_id
                      ? mediaReady
                        ? "Sin vista previa disponible"
                        : "Cargando vista previa…"
                      : "Sin imagen asociada"}
                  </Text>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {draft.media_file_id && (
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => {
                    update({ media_file_id: null })
                    setPreviewUrl(null)
                    setPreviewError(null)
                  }}
                  disabled={uploading || saving}
                >
                  Quitar imagen del banner
                </Button>
              )}
              <Text size="xsmall" className="text-ui-fg-subtle">
                El archivo anterior no se borra del File Module.
              </Text>
            </div>

            <Text size="xsmall" className="text-ui-fg-subtle border-ui-border-base border-t pt-3">
              Diferencia pendiente con el administrador histórico: el recorte y zoom del banner
              (<code className="font-mono">crop_zoom</code>, offsets y{" "}
              <code className="font-mono">original_src</code>) no existen en este backend. Sube la
              imagen ya recortada; no se simula persistencia del ajuste.
            </Text>
          </section>

          <section
            aria-labelledby="banner-distribution-heading"
            className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-4 rounded-lg border p-4 sm:p-5"
          >
            <div>
              <Heading level="h2" id="banner-distribution-heading" className="text-base">
                Distribución y activación
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                La ubicación decide dónde aparece; la prioridad domina el orden de presentación.
              </Text>
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-slot" className={labelClass}>
                ¿Dónde aparece?
              </label>
              <select
                id="banner-slot"
                aria-label="¿Dónde aparece?"
                className={selectClass}
                value={draft.slot}
                onChange={(event) => setSlot(event.target.value as Slot)}
              >
                <option value="hint">Bajo el logo (fijo)</option>
                <option value="promo">Modal de entrada</option>
              </select>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {draft.slot === "promo"
                  ? "El modal se abre solo si está publicado, habilitado, dentro de sus fechas y con apertura automática."
                  : "El banner bajo el logo siempre está visible en la portada mientras esté publicado y habilitado."}
              </Text>
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-rotation-seconds" className={labelClass}>
                Duración en pantalla
              </label>
              <select
                id="banner-rotation-seconds"
                aria-label="Duración en pantalla"
                className={selectClass}
                aria-invalid={Boolean(visibleErrors.rotationSeconds)}
                aria-describedby={
                  visibleErrors.rotationSeconds ? "banner-rotation-seconds-error" : undefined
                }
                value={String(draft.rotation_seconds)}
                onChange={(event) => update({ rotation_seconds: Number(event.target.value) })}
              >
                {/* Si el valor persistido no es un preset, se conserva como opción para no perderlo. */}
                {Array.from(new Set([...ROTATION_PRESETS, draft.rotation_seconds]))
                  .sort((a, b) => a - b)
                  .map((seconds) => (
                    <option key={seconds} value={String(seconds)}>
                      {seconds} s
                    </option>
                  ))}
              </select>
              {visibleErrors.rotationSeconds ? (
                <Text
                  id="banner-rotation-seconds-error"
                  role="alert"
                  size="xsmall"
                  className="text-ui-fg-error"
                >
                  {visibleErrors.rotationSeconds}
                </Text>
              ) : (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Se usa cuando hay más de un anuncio en este lugar; con uno solo no rota.
                </Text>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-y-1">
                <label htmlFor="banner-priority" className={labelClass}>
                  Prioridad Banner
                </label>
                <Input
                  id="banner-priority"
                  type="number"
                  min={0}
                  max={PRIORITY_MAX}
                  step={1}
                  aria-label="Prioridad Banner"
                  aria-invalid={Boolean(visibleErrors.priority)}
                  aria-describedby={visibleErrors.priority ? "banner-priority-error" : undefined}
                  value={draft.priority}
                  onChange={(event) => update({ priority: Number(event.target.value) })}
                />
                {visibleErrors.priority ? (
                  <Text id="banner-priority-error" role="alert" size="xsmall" className="text-ui-fg-error">
                    {visibleErrors.priority}
                  </Text>
                ) : (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    De 0 a {PRIORITY_MAX}. Mayor gana.
                  </Text>
                )}
              </div>

              <div className="flex flex-col gap-y-1">
                <label htmlFor="banner-sort-order" className={labelClass}>
                  Orden Banner
                </label>
                <Input
                  id="banner-sort-order"
                  type="number"
                  min={0}
                  step={1}
                  aria-label="Orden Banner"
                  aria-invalid={Boolean(visibleErrors.sortOrder)}
                  aria-describedby={visibleErrors.sortOrder ? "banner-sort-order-error" : undefined}
                  value={draft.sort_order}
                  onChange={(event) => update({ sort_order: Number(event.target.value) })}
                />
                {visibleErrors.sortOrder && (
                  <Text id="banner-sort-order-error" role="alert" size="xsmall" className="text-ui-fg-error">
                    {visibleErrors.sortOrder}
                  </Text>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-status" className={labelClass}>
                Estado Banner
              </label>
              <select
                id="banner-status"
                aria-label="Estado Banner"
                className={selectClass}
                value={draft.status}
                onChange={(event) => update({ status: event.target.value as Status })}
              >
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>

            <div className="border-ui-border-base flex items-center justify-between gap-3 rounded-md border px-3 py-3">
              <div>
                <span className="text-sm font-medium">Activo Banner</span>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Si está deshabilitado, no se muestra aunque esté publicado.
                </Text>
              </div>
              <Switch
                id="banner-enabled"
                aria-label="Activo Banner"
                checked={draft.enabled}
                onCheckedChange={(checked) => update({ enabled: checked })}
              />
            </div>

            {draft.slot === "promo" && (
              <div className="border-ui-border-base flex flex-col gap-y-3 rounded-md border px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium">Apertura automática</span>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Solo para el modal. El storefront lo abre a los ~700 ms.
                    </Text>
                  </div>
                  <Switch
                    id="banner-auto-open"
                    aria-label="Apertura automática"
                    checked={draft.auto_open}
                    onCheckedChange={(checked) => update({ auto_open: checked })}
                  />
                </div>

                <div className="flex flex-col gap-y-1">
                  <label htmlFor="banner-frequency" className={labelClass}>
                    Frecuencia Banner
                  </label>
                  <select
                    id="banner-frequency"
                    aria-label="Frecuencia Banner"
                    className={selectClass}
                    value={draft.frequency}
                    onChange={(event) => update({ frequency: event.target.value as Frequency })}
                  >
                    <option value="every">Cada recarga completa</option>
                    <option value="session">Una vez por sesión</option>
                    <option value="daily">Una vez al día</option>
                    <option value="once">Una vez por navegador</option>
                  </select>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    La frecuencia controla cuándo se vuelve a abrir el modal, no si está publicado.
                  </Text>
                </div>
              </div>
            )}
          </section>
        </div>

        <section
          aria-labelledby="banner-content-heading"
          className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-4 rounded-lg border p-4 sm:p-5"
        >
          <div>
            <Heading level="h2" id="banner-content-heading" className="text-base">
              Contenido bilingüe
            </Heading>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              Título, descripción y texto alternativo en español e inglés. Ambos idiomas son
              obligatorios para el título y el alt.
            </Text>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(["es", "en"] as const).map((language) => {
              const content = draft.translations[language]
              const titleKey = language === "es" ? "esTitle" : "enTitle"
              const altKey = language === "es" ? "esAlt" : "enAlt"
              const descriptionKey = language === "es" ? "esDescription" : "enDescription"
              const ctaLabelKey = language === "es" ? "esCtaLabel" : "enCtaLabel"

              return (
                <fieldset key={language} className="border-ui-border-base flex flex-col gap-y-3 rounded-md border p-3">
                  <legend className="px-1 text-sm font-medium">
                    {language === "es" ? "Español" : "English"}
                  </legend>

                  <div className="flex flex-col gap-y-1">
                    <label htmlFor={FIELD_ID[titleKey]} className={labelClass}>
                      {language === "es" ? "Banner título es" : "Banner título en"}
                    </label>
                    <Input
                      id={FIELD_ID[titleKey]}
                      value={content.title}
                      maxLength={TITLE_MAX}
                      aria-invalid={Boolean(visibleErrors[titleKey])}
                      aria-describedby={visibleErrors[titleKey] ? `${FIELD_ID[titleKey]}-error` : undefined}
                      onChange={(event) => updateTranslation(language, { title: event.target.value })}
                    />
                    <div className="flex items-center justify-between gap-2">
                      {visibleErrors[titleKey] ? (
                        <Text
                          id={`${FIELD_ID[titleKey]}-error`}
                          role="alert"
                          size="xsmall"
                          className="text-ui-fg-error"
                        >
                          {visibleErrors[titleKey]}
                        </Text>
                      ) : (
                        <span />
                      )}
                      <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
                        {content.title.trim().length}/{TITLE_MAX}
                      </Text>
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-1">
                    <label htmlFor={FIELD_ID[altKey]} className={labelClass}>
                      {language === "es" ? "Texto alternativo Banner es" : "Texto alternativo Banner en"}
                    </label>
                    <Input
                      id={FIELD_ID[altKey]}
                      value={content.alt}
                      maxLength={ALT_MAX}
                      aria-invalid={Boolean(visibleErrors[altKey])}
                      aria-describedby={visibleErrors[altKey] ? `${FIELD_ID[altKey]}-error` : undefined}
                      onChange={(event) => updateTranslation(language, { alt: event.target.value })}
                    />
                    {visibleErrors[altKey] && (
                      <Text
                        id={`${FIELD_ID[altKey]}-error`}
                        role="alert"
                        size="xsmall"
                        className="text-ui-fg-error"
                      >
                        {visibleErrors[altKey]}
                      </Text>
                    )}
                  </div>

                  <div className="flex flex-col gap-y-1">
                    <label htmlFor={FIELD_ID[descriptionKey]} className={labelClass}>
                      {language === "es" ? "Banner descripción es" : "Banner descripción en"}
                    </label>
                    <Textarea
                      id={FIELD_ID[descriptionKey]}
                      value={content.description ?? ""}
                      maxLength={DESCRIPTION_MAX}
                      aria-invalid={Boolean(visibleErrors[descriptionKey])}
                      aria-describedby={
                        visibleErrors[descriptionKey] ? `${FIELD_ID[descriptionKey]}-error` : undefined
                      }
                      onChange={(event) => updateTranslation(language, { description: event.target.value })}
                    />
                    <div className="flex items-center justify-between gap-2">
                      {visibleErrors[descriptionKey] ? (
                        <Text
                          id={`${FIELD_ID[descriptionKey]}-error`}
                          role="alert"
                          size="xsmall"
                          className="text-ui-fg-error"
                        >
                          {visibleErrors[descriptionKey]}
                        </Text>
                      ) : (
                        <span />
                      )}
                      <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
                        {(content.description ?? "").length}/{DESCRIPTION_MAX}
                      </Text>
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-1">
                    <label htmlFor={FIELD_ID[ctaLabelKey]} className={labelClass}>
                      {language === "es" ? "Etiqueta CTA es" : "Etiqueta CTA en"}
                    </label>
                    <Input
                      id={FIELD_ID[ctaLabelKey]}
                      value={content.cta_label ?? ""}
                      maxLength={CTA_LABEL_MAX}
                      aria-invalid={Boolean(visibleErrors[ctaLabelKey])}
                      aria-describedby={visibleErrors[ctaLabelKey] ? `${FIELD_ID[ctaLabelKey]}-error` : undefined}
                      onChange={(event) => updateTranslation(language, { cta_label: event.target.value })}
                    />
                    {visibleErrors[ctaLabelKey] && (
                      <Text
                        id={`${FIELD_ID[ctaLabelKey]}-error`}
                        role="alert"
                        size="xsmall"
                        className="text-ui-fg-error"
                      >
                        {visibleErrors[ctaLabelKey]}
                      </Text>
                    )}
                  </div>
                </fieldset>
              )
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section
            aria-labelledby="banner-cta-heading"
            className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-3 rounded-lg border p-4 sm:p-5"
          >
            <div>
              <Heading level="h2" id="banner-cta-heading" className="text-base">
                CTA
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                Destino del botón. Acepta rutas relativas (<code className="font-mono">/tienda</code>)
                o HTTPS.
              </Text>
            </div>
            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-cta-url" className={labelClass}>
                CTA Banner
              </label>
              <Input
                id="banner-cta-url"
                value={draft.cta_url ?? ""}
                placeholder="/tienda o https://…"
                maxLength={CTA_URL_MAX}
                aria-label="CTA Banner"
                aria-invalid={Boolean(visibleErrors.ctaUrl)}
                aria-describedby={visibleErrors.ctaUrl ? "banner-cta-url-error" : undefined}
                onChange={(event) => update({ cta_url: event.target.value || null })}
              />
              {visibleErrors.ctaUrl && (
                <Text id="banner-cta-url-error" role="alert" size="xsmall" className="text-ui-fg-error">
                  {visibleErrors.ctaUrl}
                </Text>
              )}
            </div>
          </section>

          <section
            aria-labelledby="banner-schedule-heading"
            className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-3 rounded-lg border p-4 sm:p-5"
          >
            <div>
              <Heading level="h2" id="banner-schedule-heading" className="text-base">
                Programación
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                Opcional. Se guarda en UTC; el formulario usa tu hora local. Sin fechas, permanece
                hasta que lo desactives.
              </Text>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Presets de vigencia">
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => update({ starts_at: null, ends_at: null })}
              >
                Permanente
              </Button>
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => applyDatePreset(7)}
              >
                1 semana
              </Button>
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => applyDatePreset(14)}
              >
                2 semanas
              </Button>
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => document.getElementById("banner-starts-at")?.focus()}
              >
                Personalizado
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-y-1">
                <label htmlFor="banner-starts-at" className={labelClass}>
                  Inicio Banner
                </label>
                <Input
                  id="banner-starts-at"
                  type="datetime-local"
                  aria-label="Inicio Banner"
                  aria-invalid={Boolean(visibleErrors.startsAt)}
                  value={toDateTimeLocal(draft.starts_at)}
                  onChange={(event) => update({ starts_at: toIso(event.target.value) })}
                />
                {visibleErrors.startsAt && (
                  <Text role="alert" size="xsmall" className="text-ui-fg-error">
                    {visibleErrors.startsAt}
                  </Text>
                )}
              </div>

              <div className="flex flex-col gap-y-1">
                <label htmlFor="banner-ends-at" className={labelClass}>
                  Fin Banner
                </label>
                <Input
                  id="banner-ends-at"
                  type="datetime-local"
                  aria-label="Fin Banner"
                  aria-invalid={Boolean(visibleErrors.endsAt)}
                  aria-describedby={visibleErrors.endsAt ? "banner-ends-at-error" : undefined}
                  value={toDateTimeLocal(draft.ends_at)}
                  onChange={(event) => update({ ends_at: toIso(event.target.value) })}
                />
                {visibleErrors.endsAt && (
                  <Text id="banner-ends-at-error" role="alert" size="xsmall" className="text-ui-fg-error">
                    {visibleErrors.endsAt}
                  </Text>
                )}
              </div>
            </div>

            <Text size="xsmall" className="text-ui-fg-subtle">
              Vigencia: {vigenciaLabel(draft)}
            </Text>
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" isLoading={saving} disabled={uploading}>
            {initial ? "Guardar cambios" : "Crear Banner"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          {errorCount > 0 && attempted && (
            <Text size="small" className="text-ui-fg-subtle">
              <ExclamationCircle aria-hidden className="mr-1 inline h-4 w-4" />
              Hay campos por corregir.
            </Text>
          )}
        </div>
      </form>
    </Container>
  )
}
