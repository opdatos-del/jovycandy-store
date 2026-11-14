import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { GET } from "../route"

type Family = {
  id: string
  slug: string
  name: string
  description: string | null
  sort_order: number
  medusa_category_id: string
}

type FakeResponse = {
  statusCode: number
  body: { families?: Family[]; message?: string }
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

function fakeRequest(category: Record<string, unknown> | undefined) {
  const service = {
    listCatalogueCategories: jest.fn(async () => category ? [category] : []),
    listProductFamilies: jest.fn(async () => [{
      id: "family_chamoy",
      slug: "chamoy",
      name: "Chamoy",
      description: null,
      sort_order: 0,
      medusa_category_id: "pcat_chamoy",
    }]),
  }
  const request = {
    query: { category_key: "sazonador" },
    scope: { resolve: () => service },
  } as unknown as MedusaRequest

  return { request, service }
}

describe("GET /store/jovy/catalogue/families", () => {
  it.each([
    ["inactiva", { active: false, coming_soon: false, interaction_locked: false }],
    ["históricamente próxima", { active: true, coming_soon: true, interaction_locked: false }],
    ["con bloqueo manual", { active: true, coming_soon: false, interaction_locked: true }],
  ])("no resuelve familias cuando la categoría está %s", async (_state, interaction) => {
    const { request, service } = fakeRequest({
      id: "category_sazonador",
      key: "sazonador",
      medusa_category_id: "pcat_chamoy",
      ...interaction,
    })
    const response = fakeResponse()

    await GET(request, response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ families: [] })
    expect(service.listProductFamilies).not.toHaveBeenCalled()
  })

  it("resuelve familias cuando la categoría está activa y libre", async () => {
    const { request, service } = fakeRequest({
      id: "category_sazonador",
      key: "sazonador",
      medusa_category_id: "pcat_chamoy",
      active: true,
      coming_soon: false,
      interaction_locked: false,
    })
    const response = fakeResponse()

    await GET(request, response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(200)
    expect(response.body.families).toHaveLength(1)
    expect(service.listProductFamilies).toHaveBeenCalledWith(
      { active: true, medusa_category_id: "pcat_chamoy" },
      { order: { sort_order: "ASC", created_at: "ASC" } },
    )
  })

  it("mantiene 404 para una clave de categoría fuera del contrato público", async () => {
    const { request, service } = fakeRequest(undefined)
    const response = fakeResponse()
    request.query = { category_key: "no-existe" }

    await GET(request, response as unknown as MedusaResponse)

    expect(response.statusCode).toBe(404)
    expect(response.body).toEqual({ message: "Categoría de catálogo no encontrada" })
    expect(service.listCatalogueCategories).not.toHaveBeenCalled()
  })
})
