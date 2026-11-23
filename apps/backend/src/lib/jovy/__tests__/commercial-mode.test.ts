import { MedusaError } from "@medusajs/framework/utils"
import {
  assertVariantsSellable,
  extractVariantIds,
  isEditorialTableMissing,
  resolveVariantProductIds,
  type CommercialModeDeps,
} from "@jovy/lib/jovy/commercial-mode"
import {
  resolveCommercialMode,
  sellableRequirements,
  type CommercialMode,
  type EditorialProductRef,
} from "@jovy/lib/jovy/product-editorial"
import { decorateProductEditorial } from "@jovy/lib/jovy/product-editorial-graph"

describe("resolveCommercialMode", () => {
  it("resuelve sellable sólo cuando está explícitamente marcado", () => {
    expect(resolveCommercialMode("sellable")).toBe("SELLABLE")
    expect(resolveCommercialMode("catalog_only")).toBe("CATALOG_ONLY")
  })

  it("trata null y ausencia como catálogo histórico, nunca como venta", () => {
    expect(resolveCommercialMode(null)).toBe("CATALOG_ONLY")
    expect(resolveCommercialMode(undefined)).toBe("CATALOG_ONLY")
  })
})

describe("sellableRequirements", () => {
  it("enumera todo lo pendiente cuando no hay instantánea", () => {
    expect(sellableRequirements(null)).toEqual(["variants", "prices", "sales_channel", "inventory_policy"])
    expect(sellableRequirements({})).toEqual(["variants", "prices", "sales_channel", "inventory_policy"])
  })

  it("no devuelve requisitos cuando variantes, precios, canal e inventario están presentes", () => {
    expect(
      sellableRequirements({
        variants: [
          {
            id: "var_01",
            prices: [{ id: "price_01", amount: 100 }],
            inventory_items: [{ inventory_item_id: "iitem_01" }],
          },
        ],
        sales_channels: [{ id: "sc_01" }],
      }),
    ).toEqual([])
  })

  it("informa de lo que falta en orden estable", () => {
    expect(
      sellableRequirements({
        variants: [{ id: "var_01", prices: [] }],
      }),
    ).toEqual(["prices", "sales_channel", "inventory_policy"])

    expect(
      sellableRequirements({
        variants: [{ id: "var_01", prices: [{ id: "price_01" }], inventory_items: [] }],
        sales_channels: [{ id: "sc_01" }],
      }),
    ).toEqual(["inventory_policy"])
  })

  it("acepta allow_backorder como política de inventario", () => {
    expect(
      sellableRequirements({
        variants: [{ prices: [{ id: "price_01" }], allow_backorder: true }],
        sales_channels: [{ id: "sc_01" }],
      }),
    ).toEqual([])
  })
})

describe("decorateProductEditorial expone el diagnóstico de venta al Admin", () => {
  const decorate = (product: EditorialProductRef) =>
    decorateProductEditorial(
      {
        id: "ed_1",
        product_id: product.id,
        gramaje: null,
        certifications: null,
        sort_order: 0,
        is_new: false,
        editorial_status: "draft",
        commercial_mode: "sellable",
      },
      {
        products: new Map([[product.id, product]]),
        categories: [],
        families: [],
      },
    )

  it("informa de prices en una ficha SELLABLE sin precios", () => {
    const decorated = decorate({
      id: "prod_sin_precio",
      title: "Producto sin precio",
      status: "published",
      variants: [{ id: "var_01", prices: [], inventory_items: [{ inventory_item_id: "iitem_01" }] }],
      sales_channels: [{ id: "sc_01" }],
    })

    expect(decorated.commercial_mode).toBe("sellable")
    expect(decorated.sellable_requirements).toContain("prices")
    expect(decorated.sellable_requirements).toEqual(["prices"])
  })

  it("devuelve [] cuando hay variantes, precios, canal e inventario", () => {
    const decorated = decorate({
      id: "prod_completo",
      title: "Producto completo",
      status: "published",
      variants: [
        {
          id: "var_02",
          prices: [{ id: "price_02", amount: 100 }],
          inventory_items: [{ inventory_item_id: "iitem_02" }],
        },
      ],
      sales_channels: [{ id: "sc_01" }],
    })

    expect(decorated.sellable_requirements).toEqual([])
  })
})

describe("extracción de variant_id de los hooks", () => {
  it("agrupa variantes del input y del carrito sin repetir", () => {
    expect(
      extractVariantIds({
        input: { items: [{ variant_id: "var_1" }, { variant_id: "var_2" }] },
        cart: { items: [{ variant_id: "var_2" }, { variant_id: "var_3" }] },
      }),
    ).toEqual(["var_1", "var_2", "var_3"])
  })

  it("cubre el update de una sola variante", () => {
    expect(extractVariantIds({ input: { item_id: "item_1", update: { variant_id: "var_9" } } })).toEqual(["var_9"])
  })

  it("ignora product_id y metadata del cliente", () => {
    expect(
      extractVariantIds({
        input: {
          product_id: "prod_malicioso",
          items: [{ variant_id: "var_1", metadata: { product_id: "prod_falso" } }],
        },
        cart: { items: [{ variant_id: "var_1", product_id: "prod_falso" }] },
      }),
    ).toEqual(["var_1"])
  })

  it("devuelve vacío cuando no hay datos de carrito", () => {
    expect(extractVariantIds(null)).toEqual([])
    expect(extractVariantIds({})).toEqual([])
  })
})

function fakeDeps(overrides: Partial<CommercialModeDeps> = {}): CommercialModeDeps & {
  graph: jest.Mock
  list: jest.Mock
  onMissingTable: jest.Mock
  onValidationError: jest.Mock
} {
  const graph = jest.fn().mockResolvedValue({ data: [] })
  const list = jest.fn().mockResolvedValue([])
  const onMissingTable = jest.fn()
  const onValidationError = jest.fn()
  return {
    query: { graph } as unknown as CommercialModeDeps["query"],
    editorialService: { listProductEditorials: list },
    onMissingTable,
    onValidationError,
    graph,
    list,
    ...overrides,
  } as CommercialModeDeps & {
    graph: jest.Mock
    list: jest.Mock
    onMissingTable: jest.Mock
    onValidationError: jest.Mock
  }
}

function variantData(...variantIds: string[]) {
  return { input: { items: variantIds.map((variant_id) => ({ variant_id })) } }
}

function mapVariants(entries: Array<[string, string]>) {
  return entries.map(([id, product_id]) => ({ id, product_id }))
}

describe("resolución variant_id → product_id", () => {
  it("consulta el graph una sola vez y deduplica productos", async () => {
    const deps = fakeDeps()
    deps.graph.mockResolvedValue({
      data: mapVariants([
        ["var_1", "prod_01"],
        ["var_2", "prod_01"],
        ["var_3", "prod_02"],
      ]),
    })

    await expect(
      resolveVariantProductIds(deps.query, ["var_1", "var_2", "var_3"]),
    ).resolves.toEqual(["prod_01", "prod_02"])
    expect(deps.graph).toHaveBeenCalledTimes(1)
    expect(deps.graph.mock.calls[0][0]).toMatchObject({
      entity: "product_variant",
      filters: { id: ["var_1", "var_2", "var_3"] },
    })
  })
})

describe("validación de modalidad en el carrito", () => {
  const add = (mode: CommercialMode | null) => ({
    product_id: "prod_01",
    commercial_mode: mode,
  })

  it("permite una variante de producto vendible", async () => {
    const deps = fakeDeps()
    deps.graph.mockResolvedValue({ data: mapVariants([["var_1", "prod_01"]]) })
    deps.list.mockResolvedValue([add("sellable")])

    await expect(assertVariantsSellable(variantData("var_1"), deps)).resolves.toBe(true)
    expect(deps.list).toHaveBeenCalledWith({ product_id: ["prod_01"] })
  })

  it("rechaza catalog_only, null (histórico) y ficha ausente", async () => {
    for (const records of [[add("catalog_only")], [add(null)], []]) {
      const deps = fakeDeps()
      deps.graph.mockResolvedValue({ data: mapVariants([["var_1", "prod_01"]]) })
      deps.list.mockResolvedValue(records)

      await expect(assertVariantsSellable(variantData("var_1"), deps)).rejects.toMatchObject({
        type: MedusaError.Types.NOT_ALLOWED,
      })
    }
  })

  it("rechaza si alguna de varias variantes no es vendible", async () => {
    const deps = fakeDeps()
    deps.graph.mockResolvedValue({
      data: mapVariants([
        ["var_1", "prod_01"],
        ["var_2", "prod_02"],
      ]),
    })
    deps.list.mockResolvedValue([add("sellable"), { product_id: "prod_02", commercial_mode: null }])

    await expect(assertVariantsSellable(variantData("var_1", "var_2"), deps)).rejects.toMatchObject({
      type: MedusaError.Types.NOT_ALLOWED,
    })
  })

  it("permite varias variantes cuando todas son vendibles", async () => {
    const deps = fakeDeps()
    deps.graph.mockResolvedValue({
      data: mapVariants([
        ["var_1", "prod_01"],
        ["var_2", "prod_02"],
      ]),
    })
    deps.list.mockResolvedValue([add("sellable"), { product_id: "prod_02", commercial_mode: "sellable" }])

    await expect(assertVariantsSellable(variantData("var_1", "var_2"), deps)).resolves.toBe(true)
    expect(deps.graph).toHaveBeenCalledTimes(1)
  })

  it("ignora un product_id malicioso del cliente", async () => {
    const deps = fakeDeps()
    deps.graph.mockResolvedValue({ data: mapVariants([["var_1", "prod_01"]]) })
    deps.list.mockResolvedValue([add("sellable")])

    const data = {
      input: { product_id: "prod_otro", items: [{ variant_id: "var_1", product_id: "prod_falso" }] },
      cart: { items: [{ variant_id: "var_1" }] },
    }
    await expect(assertVariantsSellable(data, deps)).resolves.toBe(true)
    expect(deps.list).toHaveBeenCalledWith({ product_id: ["prod_01"] })
  })

  it("rechaza cuando las variantes no se pueden resolver a un producto", async () => {
    const deps = fakeDeps()
    deps.graph.mockResolvedValue({ data: [] })

    await expect(assertVariantsSellable(variantData("var_1"), deps)).rejects.toMatchObject({
      type: MedusaError.Types.NOT_ALLOWED,
    })
  })

  it("rechaza si una variante del conjunto no se resuelve", async () => {
    const deps = fakeDeps()
    deps.graph.mockResolvedValue({ data: mapVariants([["var_1", "prod_01"]]) })

    await expect(resolveVariantProductIds(deps.query, ["var_1", "var_2"])).rejects.toMatchObject({
      type: MedusaError.Types.NOT_ALLOWED,
    })
  })

  it("rechaza fail-closed si la tabla editorial no existe", async () => {
    const deps = fakeDeps()
    deps.graph.mockRejectedValue(new Error('relation "jovy_product_editorial" does not exist'))

    await expect(assertVariantsSellable(variantData("var_1"), deps)).rejects.toMatchObject({
      type: MedusaError.Types.NOT_ALLOWED,
    })
    expect(deps.onMissingTable).toHaveBeenCalledTimes(1)
  })

  it("rechaza errores no esperados sin propagar el detalle interno", async () => {
    const deps = fakeDeps()
    deps.graph.mockResolvedValue({ data: mapVariants([["var_1", "prod_01"]]) })
    deps.list.mockRejectedValue(new Error("timeout de base de datos"))

    await expect(assertVariantsSellable(variantData("var_1"), deps)).rejects.toMatchObject({
      type: MedusaError.Types.NOT_ALLOWED,
      message: "No se pudo validar la compra. Intenta de nuevo más tarde.",
    })
    expect(deps.onValidationError).toHaveBeenCalledTimes(1)
    expect(deps.onMissingTable).not.toHaveBeenCalled()
  })
})

describe("isEditorialTableMissing", () => {
  it("reconoce el error de tabla no migrada y nada más", () => {
    expect(isEditorialTableMissing(new Error('relation "jovy_product_editorial" does not exist'))).toBe(true)
    expect(isEditorialTableMissing({ message: 'relation "jovy_product_editorial" does not exist' })).toBe(true)
    expect(isEditorialTableMissing(new Error("otro fallo de base de datos"))).toBe(false)
    expect(isEditorialTableMissing(null)).toBe(false)
  })
})
