import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MAX_VISIBLE_GALLERY_ITEMS } from "@jovy/lib/jovy/brand"
import { isEventVisible } from "@jovy/lib/jovy/events"

const EDITORIAL_STATUSES = ["draft", "published", "archived"] as const
const EVENT_STATUSES = ["draft", "published", "archived", "cancelled"] as const
const CONTACT_TYPES = ["national-sales", "international-sales", "customer-service", "catalogue"] as const
const CONTACT_STATUSES = ["pending", "handled"] as const

/** Draft lists are a short operational queue, not a full paginated listing. */
export const PENDING_LIMIT = 5

/**
 * Module keys must match `/^[a-zA-Z_][0-9a-zA-Z_]*$/`, so the folders
 * `jovy-catalogue`, `jovy-launches` and `jovy-announcements` (if they are ever
 * installed) register with underscores. Missing registrations are expected and
 * must never break the dashboard.
 */
export const OPTIONAL_JOVY_MODULES = [
  {
    key: "jovy_catalogue",
    label: "Catálogo",
    metrics: [
      { key: "categories", label: "Categorías", method: "listAndCountCatalogueCategories" },
      { key: "families", label: "Familias", method: "listAndCountProductFamilies" },
    ],
  },
  {
    key: "jovy_launches",
    label: "Lanzamientos",
    metrics: [{ key: "launches", label: "Lanzamientos", method: "listAndCountLaunches" }],
  },
  {
    key: "jovy_announcements",
    label: "Anuncios",
    // Si el módulo independiente no existe, los anuncios viven como ajustes
    // dentro de `jovy_marketing`; se reporta la capacidad real, no el nombre.
    fallbackKey: "jovy_marketing",
    metrics: [
      { key: "announcements", label: "Anuncios", method: "listAndCountAnnouncements" },
      { key: "announcement_settings", label: "Ajustes", method: "listAndCountAnnouncementSettings" },
    ],
  },
] as const

type EditorialStatus = (typeof EDITORIAL_STATUSES)[number]
type EventStatus = (typeof EVENT_STATUSES)[number]
type ContactType = (typeof CONTACT_TYPES)[number]
type ContactStatus = (typeof CONTACT_STATUSES)[number]

type StatusCounts = Record<EditorialStatus, number> & { total: number }
type EventCounts = Record<EventStatus, number> & { total: number; active: number }
type ContactCounts = Record<ContactType, Record<ContactStatus, number> & { total: number }>

type PendingItem = {
  id: string
  title: string
}

type PendingMarketingItem = PendingItem & {
  kind: "hero" | "banner"
}

type DashboardEditorialPage = {
  id: string
  slug: string
  translations?: { es?: { title?: string | null } | null } | null
}

type DashboardMarketingItem = {
  id: string
  updated_at?: Date | string | null
  translations?: { es?: { title?: string | null } | null } | null
}

type DashboardEvent = {
  id: string
  title: string
  status: string
  enabled: boolean
  starts_at?: Date | string | null
  ends_at?: Date | string | null
}

type DashboardGalleryItem = { id: string }

type DashboardLogo = { id: string }

type CoreProductService = {
  listAndCountProducts: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
  listAndCountProductCategories: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
}

type EditorialService = {
  listAndCountEditorialPages: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
  listEditorialPages: (filters?: unknown, config?: unknown) => Promise<DashboardEditorialPage[]>
}

type MarketingService = {
  listAndCountHeroItems: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
  listAndCountMarketingBanners: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
  listHeroItems: (filters?: unknown, config?: unknown) => Promise<DashboardMarketingItem[]>
  listMarketingBanners: (filters?: unknown, config?: unknown) => Promise<DashboardMarketingItem[]>
}

type EventsService = {
  listAndCountJovyEvents: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
  listJovyEvents: (filters?: unknown, config?: unknown) => Promise<DashboardEvent[]>
}

type BrandService = {
  listJovyGalleryItems: (filters?: unknown, config?: unknown) => Promise<DashboardGalleryItem[]>
  listLogos: (filters?: Record<string, unknown>, config?: Record<string, unknown>) => Promise<DashboardLogo[]>
}

type ContactsService = {
  listAndCountJovyContactRequests: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
}

export type JovyDashboard = {
  generated_at: string
  core: {
    products: { count: number }
    categories: { count: number }
  }
  content: {
    pages: StatusCounts
  }
  marketing: {
    hero: StatusCounts
    banners: StatusCounts
  }
  events: EventCounts
  brand: {
    gallery: { published: number; limit: number; exceeds_limit: boolean }
    logos: { active: number }
  }
  contacts: {
    total: Record<ContactStatus, number> & { total: number }
    by_type: ContactCounts
  }
  pending: {
    content: PendingItem[]
    marketing: PendingMarketingItem[]
    events: PendingItem[]
  }
  optional_modules: Array<{
    key: string
    label: string
    installed: boolean
    counts: Array<{ key: string; label: string; count: number }>
  }>
}

function localizedTitle(item: { translations?: { es?: { title?: string | null } | null } | null }, fallback: string) {
  const title = item.translations?.es?.title
  return typeof title === "string" && title.trim().length > 0 ? title : fallback
}

async function editorialStatusCounts(
  listAndCount: (filters: Record<string, unknown>, config?: Record<string, unknown>) => Promise<[unknown[], number]>,
): Promise<StatusCounts> {
  const entries = await Promise.all(
    EDITORIAL_STATUSES.map(async (status) => {
      const [, count] = await listAndCount({ status }, { take: 1 })
      return [status, count] as const
    }),
  )
  const counts = Object.fromEntries(entries) as Record<EditorialStatus, number>
  return { ...counts, total: counts.draft + counts.published + counts.archived }
}

async function eventStatusCounts(service: EventsService): Promise<EventCounts> {
  const [counts, published] = await Promise.all([
    Promise.all(
      EVENT_STATUSES.map(async (status) => {
        const [, count] = await service.listAndCountJovyEvents({ status }, { take: 1 })
        return [status, count] as const
      }),
    ),
    // Visibility depends on `enabled` plus an optional window, so the shared
    // helper evaluates exactly the same rules as the Store API instead of
    // duplicating date comparisons in SQL. Only published rows are loaded.
    service.listJovyEvents(
      { status: "published" },
      { select: ["id", "status", "enabled", "starts_at", "ends_at"] },
    ),
  ])
  const byStatus = Object.fromEntries(counts) as Record<EventStatus, number>
  return {
    ...byStatus,
    total: EVENT_STATUSES.reduce((total, status) => total + byStatus[status], 0),
    active: published.filter((event) => isEventVisible(event)).length,
  }
}

/**
 * Contact totals use one indexed count per type/status pair. The number of
 * queries is constant (four types × two statuses) and never grows with the
 * number of stored requests; no personal fields are selected.
 */
async function contactCounts(service: ContactsService): Promise<JovyDashboard["contacts"]> {
  const byTypeEntries = await Promise.all(
    CONTACT_TYPES.map(async (contactType) => {
      const statusEntries = await Promise.all(
        CONTACT_STATUSES.map(async (status) => {
          const [, count] = await service.listAndCountJovyContactRequests(
            { contact_type: contactType, status },
            { take: 1 },
          )
          return [status, count] as const
        }),
      )
      const statusCounts = Object.fromEntries(statusEntries) as Record<ContactStatus, number>
      return [
        contactType,
        { ...statusCounts, total: statusCounts.pending + statusCounts.handled },
      ] as const
    }),
  )
  const byType = Object.fromEntries(byTypeEntries) as ContactCounts
  const total = CONTACT_TYPES.reduce(
    (accumulator, type) => ({
      pending: accumulator.pending + byType[type].pending,
      handled: accumulator.handled + byType[type].handled,
    }),
    { pending: 0, handled: 0 },
  )
  return { total: { ...total, total: total.pending + total.handled }, by_type: byType }
}

function resolveOptional(container: MedusaContainer, key: string) {
  try {
    // Awilix returns `undefined` instead of throwing when the registration is
    // absent, which is the supported way to detect optional modules.
    return container.resolve(key, { allowUnregistered: true }) ?? null
  } catch {
    return null
  }
}

type OptionalMetric = { key: string; label: string; method: string }
type OptionalModuleDefinition = {
  key: string
  label: string
  fallbackKey?: string
  metrics: readonly OptionalMetric[]
}

async function optionalModuleSummary(container: MedusaContainer, definition: OptionalModuleDefinition) {
  const service =
    resolveOptional(container, definition.key) ??
    (definition.fallbackKey ? resolveOptional(container, definition.fallbackKey) : null)
  const source = service as Record<string, unknown> | null
  const metrics = definition.metrics.filter((metric) => typeof source?.[metric.method] === "function")

  if (metrics.length === 0) {
    return { key: definition.key, label: definition.label, installed: false, counts: [] }
  }

  const counts = (
    await Promise.all(
      metrics.map(async (metric) => {
        try {
          const listAndCount = source![metric.method] as (
            filters?: unknown,
            config?: unknown,
          ) => Promise<[unknown[], number]>
          const [, count] = await listAndCount.call(source, {}, { take: 1 })
          return { key: metric.key, label: metric.label, count }
        } catch {
          // Un módulo puede estar registrado antes de aplicar sus migraciones.
          // Un conteo fallido no debe tumbar el resto del tablero.
          return null
        }
      }),
    )
  ).filter((count): count is { key: string; label: string; count: number } => count !== null)

  return { key: definition.key, label: definition.label, installed: true, counts }
}

/**
 * Single-request snapshot of the CMS. Every source is a module service or a
 * core Medusa service; nothing is estimated. Optional modules report whether
 * they are registered plus counts for the entity methods they actually expose;
 * a missing registration or a pending migration degrades to "not installed" or
 * an empty count list instead of failing the request.
 */
export async function buildJovyDashboard(container: MedusaContainer): Promise<JovyDashboard> {
  const product = container.resolve<CoreProductService>(Modules.PRODUCT)
  const content = container.resolve<EditorialService>("jovy_content")
  const marketing = container.resolve<MarketingService>("jovy_marketing")
  const events = container.resolve<EventsService>("jovy_events")
  const brand = container.resolve<BrandService>("jovy_brand")
  const contacts = container.resolve<ContactsService>("jovy_contacts")

  const optionalModules = await Promise.all(
    OPTIONAL_JOVY_MODULES.map((module) => optionalModuleSummary(container, module)),
  )

  const [
    [, productCount],
    [, categoryCount],
    pages,
    hero,
    banners,
    eventCounts,
    galleryPublished,
    logos,
    contactTotals,
    pendingPages,
    pendingHero,
    pendingBanners,
    pendingEvents,
  ] = await Promise.all([
    product.listAndCountProducts({}, { take: 1 }),
    product.listAndCountProductCategories({}, { take: 1 }),
    editorialStatusCounts((filters, config) => content.listAndCountEditorialPages(filters, config)),
    editorialStatusCounts((filters, config) => marketing.listAndCountHeroItems(filters, config)),
    editorialStatusCounts((filters, config) => marketing.listAndCountMarketingBanners(filters, config)),
    eventStatusCounts(events),
    brand.listJovyGalleryItems({ status: "published" }, { select: ["id"] }),
    brand.listLogos({ enabled: true }, { select: ["id"] }),
    contactCounts(contacts),
    content.listEditorialPages(
      { status: "draft" },
      {
        take: PENDING_LIMIT,
        order: { updated_at: "DESC", id: "DESC" },
        select: ["id", "slug", "translations"],
      },
    ),
    marketing.listHeroItems(
      { status: "draft" },
      {
        take: PENDING_LIMIT,
        order: { updated_at: "DESC", id: "DESC" },
        select: ["id", "updated_at", "translations"],
      },
    ),
    marketing.listMarketingBanners(
      { status: "draft" },
      {
        take: PENDING_LIMIT,
        order: { updated_at: "DESC", id: "DESC" },
        select: ["id", "updated_at", "translations"],
      },
    ),
    events.listJovyEvents(
      { status: "draft" },
      { take: PENDING_LIMIT, order: { updated_at: "DESC", id: "DESC" }, select: ["id", "title"] },
    ),
  ])

  return {
    generated_at: new Date().toISOString(),
    core: {
      products: { count: productCount },
      categories: { count: categoryCount },
    },
    content: { pages },
    marketing: { hero, banners },
    events: eventCounts,
    brand: {
      gallery: {
        published: galleryPublished.length,
        limit: MAX_VISIBLE_GALLERY_ITEMS,
        exceeds_limit: galleryPublished.length > MAX_VISIBLE_GALLERY_ITEMS,
      },
      logos: { active: logos.length },
    },
    contacts: contactTotals,
    pending: {
      content: pendingPages.map((page) => ({
        id: page.id,
        title: localizedTitle(page, page.slug),
      })),
      marketing: [
        ...pendingHero.map((item) => ({ ...item, kind: "hero" as const })),
        ...pendingBanners.map((item) => ({ ...item, kind: "banner" as const })),
      ]
        .sort((left, right) => {
          const leftTime = left.updated_at ? new Date(left.updated_at).getTime() : 0
          const rightTime = right.updated_at ? new Date(right.updated_at).getTime() : 0
          return rightTime - leftTime || left.id.localeCompare(right.id)
        })
        .slice(0, PENDING_LIMIT)
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          title: localizedTitle(item, item.kind === "hero" ? "Hero sin título" : "Banner sin título"),
        })),
      events: pendingEvents.map((event) => ({ id: event.id, title: event.title })),
    },
    optional_modules: optionalModules,
  }
}
