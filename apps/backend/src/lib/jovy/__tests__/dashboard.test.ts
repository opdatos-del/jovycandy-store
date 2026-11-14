import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { buildJovyDashboard } from "../dashboard"

type StatusCounts = Record<string, number>

function statusService(counts: StatusCounts, rows: Record<string, unknown[]> = {}) {
  return {
    listAndCount: jest.fn(async (filters: Record<string, unknown>) => {
      const status = String(filters.status)
      return [rows[status] ?? [], counts[status] ?? 0]
    }),
    list: jest.fn(async (filters: Record<string, unknown>) => rows[String(filters.status)] ?? []),
  }
}

function makeContainer(overrides: Record<string, unknown> = {}) {
  const products = {
    listAndCountProducts: jest.fn(async () => [[], 12]),
    listAndCountProductCategories: jest.fn(async () => [[], 3]),
  }
  const content = statusService(
    { draft: 2, published: 4, archived: 1 },
    {
      draft: [
        { id: "page_1", slug: "nosotros", translations: { es: { title: "Nosotros" } } },
        { id: "page_2", slug: "sin-titulo", translations: { es: {} } },
      ],
    },
  )
  const hero = statusService(
    { draft: 1, published: 1, archived: 0 },
    {
      draft: [
        {
          id: "hero_1",
          updated_at: "2026-11-10T10:00:00.000Z",
          translations: { es: { title: "Hero borrador" } },
        },
      ],
    },
  )
  const banners = statusService(
    { draft: 2, published: 0, archived: 0 },
    {
      draft: [
        {
          id: "banner_1",
          updated_at: "2026-11-12T10:00:00.000Z",
          translations: { es: { title: "Banner borrador" } },
        },
        {
          id: "banner_2",
          updated_at: "2026-11-11T10:00:00.000Z",
          translations: { es: { title: "Banner anterior" } },
        },
      ],
    },
  )
  const events = {
    listAndCountJovyEvents: jest.fn(async (filters: Record<string, unknown>) => {
      const counts: StatusCounts = { draft: 1, published: 3, archived: 1, cancelled: 1 }
      return [[], counts[String(filters.status)] ?? 0]
    }),
    listJovyEvents: jest.fn(async (filters: Record<string, unknown>) => {
      if (filters.status !== "published") {
        return [{ id: "event_draft", title: "Borrador", status: "draft", enabled: true }]
      }
      const now = Date.now()
      return [
        {
          id: "event_active",
          title: "Evento vigente",
          status: "published",
          enabled: true,
          starts_at: new Date(now - 60_000).toISOString(),
          ends_at: new Date(now + 60_000).toISOString(),
        },
        {
          id: "event_future",
          title: "Evento futuro",
          status: "published",
          enabled: true,
          starts_at: new Date(now + 60_000).toISOString(),
          ends_at: new Date(now + 120_000).toISOString(),
        },
        {
          id: "event_disabled",
          title: "Evento desactivado",
          status: "published",
          enabled: false,
          starts_at: null,
          ends_at: null,
        },
      ]
    }),
  }
  const brand = {
    listJovyGalleryItems: jest.fn(async () =>
      Array.from({ length: 5 }, (_, index) => ({ id: `gallery_${index}`, enabled: true })),
    ),
    listLogos: jest.fn(async () => [{ id: "logo_1" }, { id: "logo_2" }, { id: "logo_3" }]),
  }
  const contacts = {
    listAndCountJovyContactRequests: jest.fn(async (filters: Record<string, unknown>) => {
      const matrix: Record<string, Record<string, number>> = {
        "national-sales": { pending: 2, handled: 1 },
        "international-sales": { pending: 0, handled: 3 },
        "customer-service": { pending: 4, handled: 0 },
        catalogue: { pending: 1, handled: 1 },
      }
      const rows = [{ id: "contact_1", email: "ana@example.test", first_name: "Ana" }]
      return [rows, matrix[String(filters.contact_type)]?.[String(filters.status)] ?? 0]
    }),
  }
  const services: Record<string, unknown> = {
    [Modules.PRODUCT]: products,
    jovy_content: {
      listAndCountEditorialPages: content.listAndCount,
      listEditorialPages: content.list,
    },
    jovy_marketing: {
      listAndCountHeroItems: hero.listAndCount,
      listHeroItems: hero.list,
      listAndCountMarketingBanners: banners.listAndCount,
      listMarketingBanners: banners.list,
    },
    jovy_events: events,
    jovy_brand: brand,
    jovy_contacts: contacts,
    ...overrides,
  }
  const resolve = jest.fn((key: string, options?: { allowUnregistered?: boolean }) => {
    if (key in services) {
      return services[key]
    }
    if (options?.allowUnregistered) {
      return undefined
    }
    throw new Error(`Unexpected registration ${key}`)
  })

  return {
    container: { resolve } as unknown as MedusaContainer,
    resolve,
    products,
    content,
    hero,
    banners,
    events,
    brand,
    contacts,
  }
}

describe("buildJovyDashboard", () => {
  it("agrega los contadores reales de cada módulo en una sola instantánea", async () => {
    const { container } = makeContainer()

    const dashboard = await buildJovyDashboard(container)

    expect(dashboard.core).toEqual({ products: { count: 12 }, categories: { count: 3 } })
    expect(dashboard.content.pages).toEqual({ draft: 2, published: 4, archived: 1, total: 7 })
    expect(dashboard.marketing.hero).toEqual({ draft: 1, published: 1, archived: 0, total: 2 })
    expect(dashboard.marketing.banners).toEqual({ draft: 2, published: 0, archived: 0, total: 2 })
    expect(dashboard.events).toEqual({
      draft: 1,
      published: 3,
      archived: 1,
      cancelled: 1,
      total: 6,
      active: 1,
    })
    expect(dashboard.brand).toEqual({
      gallery: { published: 5, limit: 4, exceeds_limit: true },
      logos: { active: 3 },
    })
  })

  it("cruza solicitudes por tipo y estado sin exponer datos personales", async () => {
    const { container, contacts } = makeContainer()

    const dashboard = await buildJovyDashboard(container)

    expect(dashboard.contacts.total).toEqual({ pending: 7, handled: 5, total: 12 })
    expect(dashboard.contacts.by_type["national-sales"]).toEqual({ pending: 2, handled: 1, total: 3 })
    expect(dashboard.contacts.by_type.catalogue).toEqual({ pending: 1, handled: 1, total: 2 })
    // Cuatro tipos por dos estados: el costo es constante y no depende de las filas.
    expect(contacts.listAndCountJovyContactRequests).toHaveBeenCalledTimes(8)
    const serialized = JSON.stringify(dashboard)
    expect(serialized).not.toContain("ana@example.test")
    expect(serialized).not.toContain("\"first_name\"")
  })

  it("lista solo borradores con título e id y ordena marketing por actualización", async () => {
    const { container } = makeContainer()

    const dashboard = await buildJovyDashboard(container)

    expect(dashboard.pending.content).toEqual([
      { id: "page_1", title: "Nosotros" },
      { id: "page_2", title: "sin-titulo" },
    ])
    expect(dashboard.pending.marketing).toEqual([
      { id: "banner_1", kind: "banner", title: "Banner borrador" },
      { id: "banner_2", kind: "banner", title: "Banner anterior" },
      { id: "hero_1", kind: "hero", title: "Hero borrador" },
    ])
    expect(dashboard.pending.events).toEqual([{ id: "event_draft", title: "Borrador" }])
  })

  it("marca los módulos CMS opcionales sin fallar cuando no están registrados", async () => {
    const { container, resolve } = makeContainer()

    const dashboard = await buildJovyDashboard(container)

    expect(dashboard.optional_modules).toEqual([
      { key: "jovy_catalogue", label: "Catálogo", installed: false, counts: [] },
      { key: "jovy_launches", label: "Lanzamientos", installed: false, counts: [] },
      { key: "jovy_announcements", label: "Anuncios", installed: false, counts: [] },
    ])
    expect(resolve).toHaveBeenCalledWith("jovy_catalogue", { allowUnregistered: true })
  })

  it("detecta un módulo opcional instalado y cuenta solo sus entidades conocidas", async () => {
    const { container } = makeContainer()
    const catalogue = {
      listAndCountCatalogueCategories: jest.fn(async () => [[], 4]),
      listAndCountProductFamilies: jest.fn(async () => [[], 2]),
    }
    const scope = {
      resolve: jest.fn((key: string, options?: { allowUnregistered?: boolean }) =>
        key === "jovy_catalogue"
          ? catalogue
          : (container.resolve as unknown as (name: string, config?: unknown) => unknown)(key, options),
      ),
    } as unknown as MedusaContainer

    const dashboard = await buildJovyDashboard(scope)

    expect(dashboard.optional_modules.find((module) => module.key === "jovy_catalogue")).toEqual({
      key: "jovy_catalogue",
      label: "Catálogo",
      installed: true,
      counts: [
        { key: "categories", label: "Categorías", count: 4 },
        { key: "families", label: "Familias", count: 2 },
      ],
    })
    expect(catalogue.listAndCountCatalogueCategories).toHaveBeenCalledWith({}, { take: 1 })
  })

  it("reconoce anuncios alojados en jovy_marketing cuando no hay módulo propio", async () => {
    const { container } = makeContainer()
    const marketing = (
      container.resolve as unknown as (name: string) => Record<string, unknown>
    )("jovy_marketing")
    marketing.listAndCountAnnouncementSettings = jest.fn(async () => [[], 1])

    const dashboard = await buildJovyDashboard(container)

    expect(dashboard.optional_modules.find((module) => module.key === "jovy_announcements")).toEqual({
      key: "jovy_announcements",
      label: "Anuncios",
      installed: true,
      counts: [{ key: "announcement_settings", label: "Ajustes", count: 1 }],
    })
  })
})
