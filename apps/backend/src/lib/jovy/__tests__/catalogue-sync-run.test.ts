import {
  runCatalogueSync,
  type CatalogueSyncCategory,
  type CatalogueSyncFamilyInput,
  type CatalogueSyncLinkedFamily,
  type CatalogueSyncPorts,
} from "@jovy/lib/jovy/catalogue-sync-run"
import type { ProductFamilyLink, SyncFamilyRef, SyncProductRef } from "@jovy/lib/jovy/catalogue-sync"

type HarnessOptions = {
  categories: CatalogueSyncCategory[]
  families?: SyncFamilyRef[]
  products?: SyncProductRef[]
  linkedFamilies?: CatalogueSyncLinkedFamily[]
}

/**
 * Doble en memoria de los puertos del script. Mantiene familias y vínculos
 * entre corridas para poder ejecutar dos veces y comprobar idempotencia.
 */
function createHarness(options: HarnessOptions) {
  const families = [...(options.families ?? [])]
  const familyLinks = new Map<string, Set<string>>()
  for (const family of options.linkedFamilies ?? []) {
    for (const product of family.products ?? []) {
      const products = familyLinks.get(family.id) ?? new Set<string>()
      products.add(product.id)
      familyLinks.set(family.id, products)
    }
  }

  const createdFamilies: CatalogueSyncFamilyInput[] = []
  const mappedFamilies: Array<{ family_id: string; category_id: string }> = []
  const createdLinks: ProductFamilyLink[] = []
  const info: string[] = []
  const warn: string[] = []

  const ports: CatalogueSyncPorts = {
    logger: {
      info: (message) => info.push(message),
      warn: (message) => warn.push(message),
    },
    seedCategories: async () => ({ created: 6 }),
    listCategories: async () => options.categories,
    listFamilies: async () => families.map((family) => ({ ...family })),
    createFamily: async (input) => {
      createdFamilies.push(input)
      const family: SyncFamilyRef = {
        id: `fam_created_${createdFamilies.length}`,
        slug: input.slug,
        medusa_category_id: input.medusa_category_id,
      }
      families.push(family)
      return family
    },
    mapFamilyToCategory: async (input) => {
      mappedFamilies.push(input)
    },
    listProducts: async () => options.products ?? [],
    listLinkedFamilies: async () =>
      [...familyLinks.entries()].map(([id, products]) => ({
        id,
        products: [...products].map((productId) => ({ id: productId })),
      })),
    createProductFamilyLink: async (link) => {
      createdLinks.push(link)
      const products = familyLinks.get(link.family_id) ?? new Set<string>()
      products.add(link.product_id)
      familyLinks.set(link.family_id, products)
    },
  }

  return { ports, families, createdFamilies, mappedFamilies, createdLinks, info, warn }
}

const categories: CatalogueSyncCategory[] = [
  { id: "pcat_chamoy", name: "Chamoy", handle: "chamoy" },
  { id: "pcat_gomitas", name: "Gomitas", handle: "gomitas" },
]

const products: SyncProductRef[] = [
  { id: "prod_1", categories: [{ id: "pcat_chamoy" }] },
  { id: "prod_2", categories: [{ id: "pcat_gomitas" }] },
]

describe("corrida de sincronización del catálogo", () => {
  it("planifica vínculos con las familias creadas en la misma corrida", async () => {
    const harness = createHarness({ categories, products })

    const report = await runCatalogueSync(harness.ports)

    expect(report.createdFamilies).toBe(2)
    expect(harness.createdFamilies.map((family) => family.slug)).toEqual(["chamoy", "gomitas"])
    // Regresión: con la lista de familias previa (vacía) el plan quedaba en 0
    // vínculos y sólo se autocorregía en la segunda corrida.
    expect(report.linksCreated).toBe(2)
    expect(harness.createdLinks).toEqual([
      { product_id: "prod_1", family_id: "fam_created_1" },
      { product_id: "prod_2", family_id: "fam_created_2" },
    ])
  })

  it("no crea familias ni vínculos en la segunda corrida", async () => {
    const harness = createHarness({ categories, products })

    const first = await runCatalogueSync(harness.ports)
    const second = await runCatalogueSync(harness.ports)

    expect(first.linksCreated).toBe(2)
    expect(second.createdFamilies).toBe(0)
    expect(second.linksCreated).toBe(0)
    expect(second.alreadyLinked).toBe(2)
    expect(harness.families).toHaveLength(2)
    expect(harness.createdLinks).toHaveLength(2)
  })

  it("mapea una familia existente por slug y vincula en la misma corrida", async () => {
    const harness = createHarness({
      categories: [categories[0]],
      families: [{ id: "fam_legacy", slug: "chamoy", medusa_category_id: null }],
      products: [{ id: "prod_1", categories: [{ id: "pcat_chamoy" }] }],
    })

    const report = await runCatalogueSync(harness.ports)

    expect(report.createdFamilies).toBe(0)
    expect(report.mappedFamilies).toBe(1)
    expect(harness.mappedFamilies).toEqual([{ family_id: "fam_legacy", category_id: "pcat_chamoy" }])
    expect(harness.createdLinks).toEqual([{ product_id: "prod_1", family_id: "fam_legacy" }])
  })

  it("no reemplaza una familia distinta ya vinculada", async () => {
    const harness = createHarness({
      categories,
      families: [{ id: "fam_chamoy", slug: "chamoy", medusa_category_id: "pcat_chamoy" }],
      products: [{ id: "prod_1", categories: [{ id: "pcat_chamoy" }] }],
      linkedFamilies: [{ id: "fam_otra", products: [{ id: "prod_1" }] }],
    })

    const report = await runCatalogueSync(harness.ports)

    expect(report.linksCreated).toBe(0)
    expect(report.conflicts).toBe(1)
    expect(harness.createdLinks).toEqual([])
    expect(harness.warn.join("\n")).toContain("no se reemplaza por fam_chamoy")
  })

  it("no consulta familias ni productos si no hay categorías", async () => {
    const harness = createHarness({ categories: [], products })
    const listFamilies = jest.spyOn(harness.ports, "listFamilies")

    const report = await runCatalogueSync(harness.ports)

    expect(report).toEqual({
      createdFamilies: 0,
      mappedFamilies: 0,
      linksCreated: 0,
      alreadyLinked: 0,
      conflicts: 0,
      withoutFamily: 0,
    })
    expect(listFamilies).not.toHaveBeenCalled()
    expect(harness.info.join("\n")).toContain("no hay Product Categories")
  })
})
