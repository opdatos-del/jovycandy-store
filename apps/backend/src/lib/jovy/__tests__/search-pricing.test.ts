import {
  PRICE_CURRENCIES,
  loadPricing,
  priceFields,
  toProductPricing,
  type ProductPricingRows,
} from "@jovy/search/helpers/pricing"

describe("precios del índice de búsqueda", () => {
  it("incluye MXN junto a las monedas históricas", () => {
    expect(PRICE_CURRENCIES).toEqual(["mxn", "eur", "usd"])
    expect(priceFields).toEqual(
      expect.objectContaining({
        min_price_mxn: expect.anything(),
        max_price_mxn: expect.anything(),
        original_price_mxn: expect.anything(),
        on_sale_mxn: expect.anything(),
      }),
    )
  })

  it("calcula mínimo, máximo y descuento MXN por variante", () => {
    const rows: ProductPricingRows = {
      mxn: [
        {
          calculated_price: { calculated_amount: 120, original_amount: 150 },
        },
        {
          calculated_price: { calculated_amount: 99.5, original_amount: 99.5 },
        },
        {
          calculated_price: { calculated_amount: null, original_amount: 80 },
        },
      ],
    }

    expect(toProductPricing(rows)).toEqual({
      min_price_mxn: 99.5,
      max_price_mxn: 120,
      original_price_mxn: 99.5,
      on_sale_mxn: false,
    })
  })

  it("conserva el precio original de la variante más barata", () => {
    const rows: ProductPricingRows = {
      mxn: [
        {
          calculated_price: { calculated_amount: 80, original_amount: 100 },
        },
        {
          calculated_price: { calculated_amount: 120, original_amount: 120 },
        },
      ],
    }

    expect(toProductPricing(rows)).toMatchObject({
      min_price_mxn: 80,
      max_price_mxn: 120,
      original_price_mxn: 100,
      on_sale_mxn: true,
    })
  })

  it("no escribe campos de una moneda sin precio", () => {
    const rows: ProductPricingRows = {
      mxn: [{ calculated_price: { calculated_amount: 50 } }],
      eur: [],
      usd: null,
    }

    expect(toProductPricing(rows)).toEqual({
      min_price_mxn: 50,
      max_price_mxn: 50,
      original_price_mxn: 50,
      on_sale_mxn: false,
    })
  })

  it("consulta el grafo una vez por moneda y conserva el contexto", async () => {
    const variants = [
      { calculated_price: { calculated_amount: 10, original_amount: 10 } },
    ]
    const graph = jest.fn().mockResolvedValue({
      data: [{ id: "prod_1", variants }],
    })

    const pricing = await loadPricing(["prod_1"], {
      container: { query: { graph } },
    } as never)

    expect(graph).toHaveBeenCalledTimes(3)
    expect(
      graph.mock.calls.map(
        ([request]: [{ context: { variants: { calculated_price: unknown } } }]) =>
          (request.context.variants.calculated_price as { currency_code: string })
            .currency_code,
      ),
    ).toEqual(["mxn", "eur", "usd"])
    expect(pricing.get("prod_1")).toEqual({
      mxn: variants,
      eur: variants,
      usd: variants,
    })
  })

  it("no consulta el grafo sin productos", async () => {
    const graph = jest.fn()

    await expect(
      loadPricing([], { container: { query: { graph } } } as never),
    ).resolves.toEqual(new Map())
    expect(graph).not.toHaveBeenCalled()
  })
})
