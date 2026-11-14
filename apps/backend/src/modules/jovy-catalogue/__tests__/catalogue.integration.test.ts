import { moduleIntegrationTestRunner, TestDatabaseUtils } from "@medusajs/test-utils"
import { compareCatalogueOrder, missingCatalogueCategorySeeds } from "@jovy/lib/jovy/catalogue"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import CatalogueCategory from "@jovy/modules/jovy-catalogue/models/catalogue-category"
import ProductFamily from "@jovy/modules/jovy-catalogue/models/product-family"
import JovyCatalogueModuleService from "@jovy/modules/jovy-catalogue/service"

jest.setTimeout(60_000)

const TEST_DATABASE = "medusa-jovy-catalogue-integration"

moduleIntegrationTestRunner<JovyCatalogueModuleService>({
  moduleName: JOVY_CATALOGUE_MODULE,
  moduleModels: [CatalogueCategory, ProductFamily],
  resolve: "./src/modules/jovy-catalogue",
  dbName: TEST_DATABASE,
  testSuite: ({ service }) => {
    beforeAll(async () => {
      // El runner migra la base de datos pero no la crea.
      await TestDatabaseUtils.dbTestUtilFactory().create(TEST_DATABASE)
    })

    afterAll(async () => {
      await TestDatabaseUtils.dbTestUtilFactory().shutdown(TEST_DATABASE)
    })

    async function seedMissingCategories() {
      const existing = await service.listCatalogueCategories({}, { take: 100 })
      const missing = missingCatalogueCategorySeeds(existing.map((category) => category.key))
      if (!missing.length) return { created: 0 }
      const created = await service.createCatalogueCategories(
        missing.map((seed) => ({ key: seed.key, name: seed.name, sort_order: seed.sort_order })),
      )
      return { created: created.length }
    }

    describe("categorías de presentación", () => {
      it("crea las seis claves una sola vez y es idempotente", async () => {
        expect((await seedMissingCategories()).created).toBe(6)
        expect((await seedMissingCategories()).created).toBe(0)

        const categories = await service.listCatalogueCategories({}, { order: { sort_order: "ASC" } })
        expect(categories).toHaveLength(6)
        expect(categories.map((category) => category.key)).toEqual([
          "sazonador",
          "chamoy",
          "gomitas_almidon",
          "dulces_paletas",
          "pinatero",
          "gomitas_grenetina",
        ])

        // El dashboard resuelve los conteos por estos métodos generados.
        const [, count] = await service.listAndCountCatalogueCategories({})
        expect(count).toBe(6)
      })

      it("conserva las ediciones al volver a sembrar", async () => {
        await seedMissingCategories()
        const [first] = await service.listCatalogueCategories({ key: "sazonador" })
        await service.updateCatalogueCategories({
          id: first.id,
          name: "Sazonador premium",
          active: false,
          coming_soon: true,
          interaction_locked: true,
        })

        expect((await seedMissingCategories()).created).toBe(0)

        const [edited] = await service.listCatalogueCategories({ key: "sazonador" })
        expect(edited).toMatchObject({
          name: "Sazonador premium",
          active: false,
          coming_soon: true,
          interaction_locked: true,
        })
      })

      it("impide duplicar una clave pública", async () => {
        await seedMissingCategories()
        await expect(
          service.createCatalogueCategories({ key: "chamoy", name: "Chamoy duplicado", sort_order: 9 }),
        ).rejects.toThrow()
      })

      it("ordena por sort_order y desempata de forma determinista", async () => {
        const categories = await service.createCatalogueCategories([
          { key: "sazonador", name: "Sazonador", sort_order: 2 },
          { key: "chamoy", name: "Chamoy", sort_order: 1 },
          { key: "pinatero", name: "Piñatero", sort_order: 1 },
        ])

        const ordered = [...categories].sort(compareCatalogueOrder)
        expect(ordered.map((category) => category.sort_order)).toEqual([1, 1, 2])
      })
    })

    describe("familias canónicas", () => {
      it("persiste familias con slug único y las lista por categoría comercial", async () => {
        const created = await service.createProductFamilies([
          { name: "Chamoy", slug: "chamoy", medusa_category_id: "pcat_chamoy", sort_order: 3 },
          { name: "Piñatero", slug: "pinatero", medusa_category_id: "pcat_pinatero", sort_order: 1 },
        ])

        const chamoy = await service.listProductFamilies({ medusa_category_id: "pcat_chamoy" })
        expect(chamoy.map((family) => family.id)).toEqual([created[0].id])
        expect((await service.listAndCountProductFamilies({}))[1]).toBe(2)

        await expect(
          service.createProductFamilies({ name: "Otro chamoy", slug: "chamoy" }),
        ).rejects.toThrow()
      })

      it("aplica borrado lógico sin perder la fila", async () => {
        await service.createProductFamilies({ name: "Gomitas", slug: "gomitas" })
        const [family] = await service.listProductFamilies({ slug: "gomitas" })

        await service.softDeleteProductFamilies(family.id)

        expect(await service.listProductFamilies({ slug: "gomitas" })).toHaveLength(0)
        expect(await service.listProductFamilies({ slug: "gomitas" }, { withDeleted: true })).toHaveLength(1)
      })
    })
  },
})
