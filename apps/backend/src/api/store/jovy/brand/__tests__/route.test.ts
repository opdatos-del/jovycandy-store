import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { GET as getGallery } from "../gallery/route"

type FakeResponse = {
  statusCode: number
  body: { items?: Array<{ id: string; sort_order: number }> } & Record<string, unknown>
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
