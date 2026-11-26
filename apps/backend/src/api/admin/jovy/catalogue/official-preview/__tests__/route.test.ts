import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import manifest from "@jovy/data/catalog/official-mx.json"
import { buildOfficialProductPlans, officialCatalogSchema } from "@jovy/lib/jovy/official-catalog"

const updateProductsWorkflowRun = jest.fn()

jest.mock("@medusajs/medusa/core-flows", () => ({
  updateProductsWorkflow: () => ({ run: updateProductsWorkflowRun }),
}))

import { POST } from "../route"

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

const plans = buildOfficialProductPlans(officialCatalogSchema.parse(manifest))
const products = plans.slice(0, 2).map((plan) => ({
  id: `prod_${plan.externalId}`,
  external_id: plan.externalId,
  title: "Título manual",
  description: "Descripción manual",
  weight: 1,
  metadata: { jovy_official_managed: true },
  variants: plan.variants.map((variant) => ({
    sku: variant.sku,
    title: variant.title,
    metadata: { jovy_official_grams: variant.grams },
    prices: [{ currency_code: "mxn", amount: variant.priceMxn }],
  })),
}))

const graph = jest.fn(async () => ({ data: products }))

function fakeRequest(body: unknown) {
  return {
    body,
    scope: {
      resolve: (key: string) =>
        key === ContainerRegistrationKeys.QUERY ? { graph } : undefined,
    },
  } as unknown as MedusaRequest
}

beforeEach(() => {
  updateProductsWorkflowRun.mockReset().mockResolvedValue({ result: [] })
  graph.mockClear()
})

describe("POST /admin/jovy/catalogue/official-preview", () => {
  it("escribe sólo los campos aprobados y nunca metadata, variantes ni inventario", async () => {
    const plan = plans[0]
    const response = fakeResponse()
    await POST(
      fakeRequest({
        updates: [{ external_id: plan.externalId, fields: ["title"] }],
      }),
      response as unknown as MedusaResponse,
    )

    expect(response.statusCode).toBe(200)
    expect(updateProductsWorkflowRun).toHaveBeenCalledWith({
      input: {
        products: [
          {
            id: `prod_${plan.externalId}`,
            title: plan.title,
          },
        ],
      },
    })
  })

  it("no ofrece un producto histórico aunque tenga external_id oficial", async () => {
    graph.mockResolvedValueOnce({
      data: [{ ...products[0], metadata: { jovy_official_managed: false } }],
    })
    const response = fakeResponse()
    await POST(
      fakeRequest({
        updates: [{ external_id: plans[0].externalId, fields: ["title"] }],
      }),
      response as unknown as MedusaResponse,
    )

    expect(response.statusCode).toBe(404)
    expect(updateProductsWorkflowRun).not.toHaveBeenCalled()
  })

  it("rechaza cuerpos vacíos o aprobaciones duplicadas antes de escribir", async () => {
    const empty = fakeResponse()
    await POST(fakeRequest({ updates: [] }), empty as unknown as MedusaResponse)
    expect(empty.statusCode).toBe(400)
    expect(updateProductsWorkflowRun).not.toHaveBeenCalled()

    const duplicate = fakeResponse()
    await POST(
      fakeRequest({
        updates: [
          { external_id: plans[0].externalId, fields: ["title"] },
          { external_id: plans[0].externalId, fields: ["description"] },
        ],
      }),
      duplicate as unknown as MedusaResponse,
    )
    expect(duplicate.statusCode).toBe(400)
    expect(updateProductsWorkflowRun).not.toHaveBeenCalled()
  })
})
