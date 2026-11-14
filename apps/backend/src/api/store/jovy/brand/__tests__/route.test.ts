import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

import { GET as getGallery } from "../gallery/route"
import { GET as getLogos } from "../logos/route"

type FakeLogo = {
  id: string
  families?: string[] | null
  family_ids?: string[]
  family_slugs?: string[]
}

type FakeResponse = {
  statusCode: number
  body: {
    items?: Array<{ id: string; sort_order: number }>
    logos?: FakeLogo[]
  } & Record<string, unknown>
  status: (code: number) => FakeResponse
  json: (body: FakeResponse["body"]) => FakeResponse
}

function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    body: {},
    status(code) {
      response.statusCode = code
      return response
    },
    json(body) {
      response.body = body
      return response
    },
  }
  return response
}

function galleryRow(index: number, status = "published", enabled = true) {
  return {
    id: `gal_${index}`,
    title: `Título privado ${index}`,
    description: null,
    media_file_id: `file_${index}`,
    status,
    enabled,
    sort_order: index,
    starts_at: null,
    ends_at: null,
  }
}

function fakeRequest(rows: ReturnType<typeof galleryRow>[]) {
  const logger = { warn: jest.fn() }
  const service = {
    listJovyGalleryItems: jest.fn(async () => rows),
    retrieveFile: jest.fn(async (id: string) => ({ id, url: `http://localhost:9000/static/${id}.png` })),
    warn: logger.warn,
  }
  return {
    request: { scope: { resolve: () => service } } as unknown as MedusaRequest,
    logger,
    service,
  }
}

describe("GET /store/jovy/brand/gallery", () => {
  it("devuelve como máximo cuatro elementos publicados y avisa sin PII", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => galleryRow(index))
    const { request, logger } = fakeRequest(rows)
    const response = fakeResponse()

    await getGallery(request, response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(200)
    expect(response.body.items?.map((item) => item.id)).toEqual(["gal_0", "gal_1", "gal_2", "gal_3"])
    expect(logger.warn).toHaveBeenCalledTimes(1)
    const [warning] = logger.warn.mock.calls[0]
    expect(warning).toContain("5")
    expect(warning).toContain("4")
    for (const row of rows) expect(warning).not.toContain(row.title)
  })

  it("mantiene los cuatro elementos y no avisa cuando no se supera el tope", async () => {
    const rows = Array.from({ length: 4 }, (_, index) => galleryRow(index))
    const { request, logger } = fakeRequest(rows)
    const response = fakeResponse()

    await getGallery(request, response as unknown as MedusaResponse)

    expect(response.body.items).toHaveLength(4)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it("cuenta sólo elementos publicados, activos y vigentes", async () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, index) => galleryRow(index)),
      galleryRow(10, "draft"),
      galleryRow(11, "published", false),
    ]
    const { request, logger } = fakeRequest(rows)
    const response = fakeResponse()

    await getGallery(request, response as unknown as MedusaResponse)

    expect(response.body.items?.map((item) => item.id)).toEqual(["gal_0", "gal_1", "gal_2", "gal_3"])
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })
})

type LogoRow = {
  id: string
  slug: string
  name: string
  alt: string | null
  families: string[] | null
  families_linked: boolean
  media_file_id: string
  crop: unknown
  sort_order: number
}

const brandFamilies = [
  { id: "fam_chamoy", slug: "chamoy", name: "Chamoy", active: true },
  { id: "fam_pinatero", slug: "pinatero", name: "Piñatero", active: true },
]

function logoRow(id: string, overrides: Partial<LogoRow> = {}): LogoRow {
  return {
    id,
    slug: id,
    name: `Logo ${id}`,
    alt: null,
    families: null,
    families_linked: true,
    media_file_id: `file_${id}`,
    crop: { zoom: 1, offset_x: 0, offset_y: 0 },
    sort_order: 0,
    ...overrides,
  }
}

function fakeLogoRequest(logos: LogoRow[], relations: Array<{ logo_id: string; family_id: string }>) {
  const brand = {
    listLogos: jest.fn(async () => logos),
    listLogoFamilies: jest.fn(async (filters: { logo_id: string[] }) =>
      relations.filter((relation) => filters.logo_id.includes(relation.logo_id))),
  }
  const catalogue = { listProductFamilies: jest.fn(async () => brandFamilies) }
  const file = { retrieveFile: jest.fn(async (id: string) => ({ id, url: `http://localhost:9000/static/${id}.png` })) }
  const request = {
    query: {},
    scope: {
      resolve: (key: string) => {
        if (key === JOVY_BRAND_MODULE) return brand
        if (key === JOVY_CATALOGUE_MODULE) return catalogue
        if (key === Modules.FILE) return file
        throw new Error(`Dependencia inesperada: ${key}`)
      },
    },
  } as unknown as MedusaRequest
  return { request, brand }
}

function withFamily(request: MedusaRequest, family?: string) {
  return { ...request, query: family ? { family } : {} } as MedusaRequest
}

describe("GET /store/jovy/brand/logos", () => {
  const rows = [
    logoRow("logo_chamoy"),
    logoRow("logo_pinatero"),
    logoRow("logo_legado", { families_linked: false, families: ["corporativa"] }),
    logoRow("logo_todas", { families_linked: true }),
  ]
  const relations = [
    { logo_id: "logo_chamoy", family_id: "fam_chamoy" },
    { logo_id: "logo_pinatero", family_id: "fam_pinatero" },
  ]

  it("filtra por identificador real y por slug de la relación", async () => {
    const { request } = fakeLogoRequest(rows, relations)
    const byId = fakeResponse()
    await getLogos(withFamily(request, "fam_chamoy"), byId as unknown as MedusaResponse)
    expect(byId.body.logos?.map((logo) => logo.id)).toEqual(["logo_chamoy", "logo_todas"])

    const bySlug = fakeResponse()
    await getLogos(withFamily(request, "pinatero"), bySlug as unknown as MedusaResponse)
    expect(bySlug.body.logos?.map((logo) => logo.id)).toEqual(["logo_pinatero", "logo_todas"])
  })

  it("mantiene los slugs legado y el alias de logo sin familias", async () => {
    const { request } = fakeLogoRequest(rows, relations)
    const legacy = fakeResponse()
    await getLogos(withFamily(request, "corporativa"), legacy as unknown as MedusaResponse)
    expect(legacy.body.logos?.map((logo) => logo.id)).toEqual(["logo_legado", "logo_todas"])

    const other = fakeResponse()
    await getLogos(withFamily(request, "dulces"), other as unknown as MedusaResponse)
    expect(other.body.logos?.map((logo) => logo.id)).toEqual(["logo_todas"])
  })

  it("devuelve todos los logos activos sin parámetro y expone familias resueltas", async () => {
    const { request } = fakeLogoRequest(rows, relations)
    const response = fakeResponse()
    await getLogos(request, response as unknown as MedusaResponse)

    expect(response.body.logos).toHaveLength(4)
    expect(response.body.logos?.[0]).toMatchObject({
      id: "logo_chamoy",
      family_ids: ["fam_chamoy"],
      family_slugs: ["chamoy"],
      families: null,
    })
    expect(response.body.logos?.[2]).toMatchObject({
      id: "logo_legado",
      family_ids: [],
      family_slugs: ["corporativa"],
      families: ["corporativa"],
    })
  })

  it("ignora un parámetro family repetido y solo consulta logos activos", async () => {
    const { request, brand } = fakeLogoRequest(rows, relations)
    const response = fakeResponse()
    const repeated = { ...request, query: { family: ["chamoy", "pinatero"] } } as unknown as MedusaRequest

    await getLogos(repeated, response as unknown as MedusaResponse)

    expect(response.body.logos).toHaveLength(4)
    expect(brand.listLogos).toHaveBeenCalledWith({ enabled: true }, { order: { sort_order: "ASC", created_at: "ASC" } })
  })
})
