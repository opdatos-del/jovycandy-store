import { compensateHeroProductLink } from "@jovy/workflows/jovy-marketing/set-hero-product"

function containerWith(link: { create: jest.Mock; dismiss: jest.Mock }) {
  return { resolve: () => link }
}

describe("Hero Product Link compensation", () => {
  it("dismisses the new product and restores the previous one", async () => {
    const link = { create: jest.fn(), dismiss: jest.fn() }
    await compensateHeroProductLink(
      { hero_id: "hero_1", previous_product_id: "prod_previous", product_id: "prod_next" },
      containerWith(link),
    )

    expect(link.dismiss).toHaveBeenCalledTimes(1)
    expect(link.dismiss).toHaveBeenCalledWith({
      product: { product_id: "prod_next" },
      jovy_marketing: { jovy_hero_item_id: "hero_1" },
    })
    expect(link.create).toHaveBeenCalledTimes(1)
    expect(link.create).toHaveBeenCalledWith({
      product: { product_id: "prod_previous" },
      jovy_marketing: { jovy_hero_item_id: "hero_1" },
    })
    expect(link.dismiss.mock.invocationCallOrder[0]).toBeLessThan(link.create.mock.invocationCallOrder[0])
  })

  it("only restores the previous product when the failed change was a removal", async () => {
    const link = { create: jest.fn(), dismiss: jest.fn() }
    await compensateHeroProductLink(
      { hero_id: "hero_1", previous_product_id: "prod_previous", product_id: null },
      containerWith(link),
    )

    expect(link.dismiss).not.toHaveBeenCalled()
    expect(link.create).toHaveBeenCalledWith({
      product: { product_id: "prod_previous" },
      jovy_marketing: { jovy_hero_item_id: "hero_1" },
    })
  })

  it("only dismisses the new product when there was no previous link", async () => {
    const link = { create: jest.fn(), dismiss: jest.fn() }
    await compensateHeroProductLink(
      { hero_id: "hero_1", previous_product_id: null, product_id: "prod_next" },
      containerWith(link),
    )

    expect(link.dismiss).toHaveBeenCalledTimes(1)
    expect(link.create).not.toHaveBeenCalled()
  })

  it("is a no-op when neither a new nor a previous link exists", async () => {
    const link = { create: jest.fn(), dismiss: jest.fn() }
    await compensateHeroProductLink(
      { hero_id: "hero_1", previous_product_id: null, product_id: null },
      containerWith(link),
    )

    expect(link.create).not.toHaveBeenCalled()
    expect(link.dismiss).not.toHaveBeenCalled()
  })
})
