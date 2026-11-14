import {
  CATALOGUE_SYNC_MAX_RECORDS,
  collectAllPages,
  orderProductCategories,
  planProductFamilyLinks,
} from "@jovy/lib/jovy/catalogue-sync"

describe("paginación de sincronización", () => {
  it("recorre todas las páginas hasta agotar la fuente", async () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({ id: `row_${index}` }))
    const fetchPage = jest.fn(async ({ take, skip }: { take: number; skip: number }) =>
      rows.slice(skip, skip + take),
    )

    await expect(collectAllPages(fetchPage, 3)).resolves.toEqual(rows)
    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage.mock.calls.map(([pagination]) => pagination.skip)).toEqual([0, 3, 6])
  })

  it("pide una última página vacía cuando el total es múltiplo del tamaño", async () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({ id: `row_${index}` }))
    const fetchPage = jest.fn(async ({ take, skip }: { take: number; skip: number }) =>
      rows.slice(skip, skip + take),
    )

    await expect(collectAllPages(fetchPage, 2)).resolves.toEqual(rows)
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it("falla con mensaje claro si la fuente no respeta el tope", async () => {
    const infinitePage = Array.from({ length: 2 }, (_, index) => ({ id: `row_${index}` }))
    // El servidor devuelve siempre lo mismo: simula un `skip` ignorado.
    await expect(collectAllPages(async () => infinitePage, 2)).rejects.toThrow(
      `La sincronización superó ${CATALOGUE_SYNC_MAX_RECORDS} registros`,
    )
  })
})

describe("orden determinista de categorías del producto", () => {
  it("ordena por rank y desempata por id", () => {
    const ordered = orderProductCategories([
      { id: "pcat_c", rank: 1 },
      { id: "pcat_b", rank: 0 },
      { id: "pcat_a", rank: 1 },
      { id: "pcat_d" },
    ])

    expect(ordered.map((category) => category.id)).toEqual(["pcat_b", "pcat_d", "pcat_a", "pcat_c"])
  })
})

describe("plan de vínculos familia-producto", () => {
  const families = [
    { id: "fam_chamoy", slug: "chamoy", medusa_category_id: "pcat_chamoy" },
    { id: "fam_gomitas", slug: "gomitas", medusa_category_id: "pcat_gomitas" },
  ]

  it("elige la primera categoría mapeada con orden determinista", () => {
    const plan = planProductFamilyLinks({
      products: [
        { id: "prod_1", categories: [{ id: "pcat_gomitas", rank: 2 }, { id: "pcat_chamoy", rank: 1 }] },
      ],
      families,
      existingLinks: [],
    })

    expect(plan.links).toEqual([{ product_id: "prod_1", family_id: "fam_chamoy" }])
    expect(plan.withoutFamily).toBe(0)
  })

  it("no duplica un vínculo ya existente", () => {
    const plan = planProductFamilyLinks({
      products: [{ id: "prod_1", categories: [{ id: "pcat_chamoy" }] }],
      families,
      existingLinks: [{ product_id: "prod_1", family_id: "fam_chamoy" }],
    })

    expect(plan.links).toEqual([])
    expect(plan.alreadyLinked).toBe(1)
  })

  it("reporta conflicto y no reemplaza una familia distinta", () => {
    const plan = planProductFamilyLinks({
      products: [{ id: "prod_1", categories: [{ id: "pcat_chamoy" }] }],
      families,
      existingLinks: [{ product_id: "prod_1", family_id: "fam_gomitas" }],
    })

    expect(plan.links).toEqual([])
    expect(plan.conflicts).toEqual([
      { product_id: "prod_1", existing_family_ids: ["fam_gomitas"], family_id: "fam_chamoy" },
    ])
  })

  it("trata una ficha con dos familias como conflicto, sin tocar vínculos", () => {
    const plan = planProductFamilyLinks({
      products: [{ id: "prod_1", categories: [{ id: "pcat_chamoy" }] }],
      families,
      existingLinks: [
        { product_id: "prod_1", family_id: "fam_chamoy" },
        { product_id: "prod_1", family_id: "fam_gomitas" },
      ],
    })

    expect(plan.links).toEqual([])
    expect(plan.conflicts).toHaveLength(1)
  })

  it("cuenta productos sin familia sin inventar una", () => {
    const plan = planProductFamilyLinks({
      products: [{ id: "prod_1", categories: [{ id: "pcat_otro" }] }, { id: "prod_2" }],
      families,
      existingLinks: [],
    })

    expect(plan.links).toEqual([])
    expect(plan.withoutFamily).toBe(2)
  })
})
