import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"

import { GET as listEditorial } from "../route"

type FakeResponse = {
  statusCode: number
  body: unknown
  status: (code: number) => FakeResponse
  json: (body: unknown) => FakeResponse
  send: () => FakeResponse
}

function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      response.statusCode = code
      return response
    },
    json(body) {
      response.body = body
      return response
    },
    send() {
      return response
    },
  }
  return response
}

const listProductEditorials = jest.fn()
const listCatalogueCategories = jest.fn()
const listProductFamilies = jest.fn()
const graph = jest.fn()

const baseRecord = {
  id: "fed_01",
  product_id: "prod_01",
  gramaje: "250 g",
  certifications: ["SGS"],
  sort_order: 2,
  is_new: false,
  editorial_status: "draft",
  deleted_at: null as string | null,
}

const services: Record<string, unknown> = {
  [JOVY_PRODUCT_EDITORIAL_MODULE]: { listProductEditorials },
  [JOVY_CATALOGUE_MODULE]: { listCatalogueCategories, listProductFamilies },
  [ContainerRegistrationKeys.QUERY]: { graph },
}

function fakeRequest(query: Record<string, unknown> = {}) {
  return {
    query,
    params: {},
    body: {},
    scope: { resolve: (key: string) => services[key] },
  } as unknown as MedusaRequest
}

beforeEach(() => {
  listProductEditorials.mockReset().mockResolvedValue([])
  listCatalogueCategories.mockReset().mockResolvedValue([])
  listProductFamilies.mockReset().mockResolvedValue([])
  graph.mockReset().mockResolvedValue({
    data: [
      {
        id: "prod_01",
        title: "Chamoy 250 g",
        handle: "chamoy-250-g",
        thumbnail: null,
        categories: [],
        jovy_product_family: null,
      },
    ],
  })
})

describe("GET /admin/jovy/products/editorial", () => {
  it("responde 200 con lista vacía cuando el producto no tiene ficha", async () => {
    const response = fakeResponse()
    await listEditorial(fakeRequest({ product_id: "prod_01" }), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ products: [] })
    expect(listProductEditorials).toHaveBeenCalledTimes(1)
    expect(listProductEditorials.mock.calls[0][0]).toEqual({ product_id: "prod_01" })
    expect(graph).not.toHaveBeenCalled()
  })

  it("filtra por product_id e incluye la ficha borrada lógicamente con deleted", async () => {
    listProductEditorials.mockResolvedValue([{ ...baseRecord, deleted_at: "2026-11-13T18:00:00.000Z" }])

    const response = fakeResponse()
    await listEditorial(fakeRequest({ product_id: "prod_01" }), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(200)
    expect(listProductEditorials.mock.calls[0][0]).toEqual({ product_id: "prod_01" })
    expect(listProductEditorials.mock.calls[0][1]).toMatchObject({
      order: { sort_order: "ASC", created_at: "ASC" },
      withDeleted: true,
    })

    const products = (response.body as { products: Array<Record<string, unknown>> }).products
    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      id: "fed_01",
      product_id: "prod_01",
      gramaje: "250 g",
      deleted: true,
      product: { id: "prod_01", title: "Chamoy 250 g" },
    })
  })

  it("mantiene el listado general sin borrar y sin withDeleted", async () => {
    listProductEditorials.mockResolvedValue([baseRecord])

    const response = fakeResponse()
    await listEditorial(fakeRequest(), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(200)
    expect(listProductEditorials.mock.calls[0][0]).toEqual({})
    expect(listProductEditorials.mock.calls[0][1]).not.toHaveProperty("withDeleted")

    const products = (response.body as { products: Array<Record<string, unknown>> }).products
    expect(products[0]).toMatchObject({ id: "fed_01", deleted: false })
  })

  it.each([[""], [["prod_01"]]])("rechaza product_id inválido (%p)", async (productId) => {
    const response = fakeResponse()
    await listEditorial(fakeRequest({ product_id: productId }), response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(400)
    expect(response.body).toEqual({ message: "El producto no es válido" })
    expect(listProductEditorials).not.toHaveBeenCalled()
  })
})
