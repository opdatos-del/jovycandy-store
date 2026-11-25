import { resolveProductIds } from "@jovy/search/helpers/resolve-product-ids"

function contextWith(query: Record<string, unknown>) {
  return { container: { query } } as never
}

describe("resolución de productos para el índice", () => {
  it("usa los IDs de un evento de producto", async () => {
    const query = { graph: jest.fn(), search: jest.fn() }

    await expect(
      resolveProductIds(
        { name: "product.updated", data: [{ id: "prod_1" }, { id: "prod_2" }] },
        contextWith(query),
      ),
    ).resolves.toEqual(["prod_1", "prod_2"])
    expect(query.graph).not.toHaveBeenCalled()
  })

  it("resuelve variantes y lee borrados lógicos", async () => {
    const query = {
      graph: jest.fn().mockResolvedValue({
        data: [{ product_id: "prod_1" }, { product_id: null }],
      }),
      search: jest.fn(),
    }

    await expect(
      resolveProductIds(
        { name: "product-variant.deleted", data: { id: "variant_1" } },
        contextWith(query),
      ),
    ).resolves.toEqual(["prod_1"])
    expect(query.graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product_variant",
        fields: ["product_id"],
        filters: { id: ["variant_1"] },
        withDeleted: true,
      }),
    )
  })

  it("resuelve productos de una Price List por price set y variante", async () => {
    const query = {
      graph: jest.fn().mockResolvedValue({
        data: [
          {
            prices: [
              { price_set: { variant: { product_id: "prod_1" } } },
              { price_set: { variant: { product_id: "prod_2" } } },
              { price_set: null },
            ],
          },
        ],
      }),
      search: jest.fn(),
    }

    await expect(
      resolveProductIds(
        {
          name: "price-list.prices_updated",
          data: { id: "plist_1", price_set_ids: ["pset_1"] },
        },
        contextWith(query),
      ),
    ).resolves.toEqual(["prod_1", "prod_2"])
    expect(query.graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "price_list",
        fields: ["prices.price_set.variant.product_id"],
        filters: { id: ["plist_1"] },
        withDeleted: false,
      }),
    )
  })

  it("resuelve productos de un canal usando el propio índice", async () => {
    const search = jest.fn().mockResolvedValue({
      search_result: { hits: [{ id: "prod_1" }, { id: "prod_2" }] },
    })

    await expect(
      resolveProductIds(
        { name: "sales-channel.deleted", data: { id: "sc_1" } },
        contextWith({ graph: jest.fn(), search }),
      ),
    ).resolves.toEqual(["prod_1", "prod_2"])
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product",
        fields: ["id"],
        filters: { sales_channel_ids: ["sc_1"] },
      }),
    )
  })

  it("ignora entidades y payloads sin IDs", async () => {
    const query = { graph: jest.fn(), search: jest.fn() }

    await expect(
      resolveProductIds(
        { name: "product.updated", data: { title: "sin id" } },
        contextWith(query),
      ),
    ).resolves.toEqual([])
    await expect(
      resolveProductIds(
        { name: "unknown.updated", data: { id: "x" } },
        contextWith(query),
      ),
    ).resolves.toEqual([])
  })
})
