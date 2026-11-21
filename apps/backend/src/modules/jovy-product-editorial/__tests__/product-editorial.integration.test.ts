import { moduleIntegrationTestRunner, TestDatabaseUtils } from "@medusajs/test-utils"
import { compareProductEditorialOrder } from "@jovy/lib/jovy/product-editorial"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"
import ProductEditorial from "@jovy/modules/jovy-product-editorial/models/product-editorial"
import JovyProductEditorialModuleService from "@jovy/modules/jovy-product-editorial/service"

jest.setTimeout(60_000)

const TEST_DATABASE = "medusa-jovy-product-editorial-integration"

moduleIntegrationTestRunner<JovyProductEditorialModuleService>({
  moduleName: JOVY_PRODUCT_EDITORIAL_MODULE,
  moduleModels: [ProductEditorial],
  resolve: "./src/modules/jovy-product-editorial",
  dbName: TEST_DATABASE,
  testSuite: ({ service }) => {
    beforeAll(async () => {
      // El runner migra la base de datos pero no la crea.
      await TestDatabaseUtils.dbTestUtilFactory().create(TEST_DATABASE)
    })

    afterAll(async () => {
      await TestDatabaseUtils.dbTestUtilFactory().shutdown(TEST_DATABASE)
    })

    it("crea una ficha por producto con los valores por defecto del dominio", async () => {
      const editorial = await service.createProductEditorials({ product_id: "prod_default" })

      expect(editorial).toMatchObject({
        product_id: "prod_default",
        gramaje: null,
        certifications: [],
        sort_order: 0,
        is_new: false,
        editorial_status: "draft",
        published_at: null,
      })
      expect((await service.listAndCountProductEditorials({}))[1]).toBe(1)
      expect((await service.retrieveProductEditorial(editorial.id)).id).toBe(editorial.id)
    })

    it("persiste gramaje, certificaciones, novedad y estado publicado", async () => {
      const created = await service.createProductEditorials({ product_id: "prod_full" })
      const publishedAt = new Date("2026-11-13T18:00:00.000Z")

      const updated = await service.updateProductEditorials({
        id: created.id,
        gramaje: "250 g",
        certifications: ["SGS", "OU Kosher"],
        sort_order: 3,
        is_new: true,
        editorial_status: "published",
        published_at: publishedAt,
      })

      expect(updated).toMatchObject({
        gramaje: "250 g",
        certifications: ["SGS", "OU Kosher"],
        sort_order: 3,
        is_new: true,
        editorial_status: "published",
      })
      expect(new Date(updated.published_at as Date).toISOString()).toBe(publishedAt.toISOString())
    })

    it("impide dos fichas para el mismo producto", async () => {
      await service.createProductEditorials({ product_id: "prod_unique" })
      await expect(service.createProductEditorials({ product_id: "prod_unique" })).rejects.toThrow()
    })

    it("borra de forma lógica sin perder la fila y permite restaurar", async () => {
      const editorial = await service.createProductEditorials({ product_id: "prod_restore", gramaje: "1 kg" })

      await service.softDeleteProductEditorials(editorial.id)
      expect(await service.listProductEditorials({ product_id: "prod_restore" })).toHaveLength(0)
      expect(
        await service.listProductEditorials({ product_id: "prod_restore" }, { withDeleted: true }),
      ).toHaveLength(1)

      await service.restoreProductEditorials(editorial.id)
      const [restored] = await service.listProductEditorials({ product_id: "prod_restore" })
      expect(restored).toMatchObject({ id: editorial.id, gramaje: "1 kg" })
    })

    it("ordena por sort_order con desempate determinista", async () => {
      await service.createProductEditorials([
        { product_id: "prod_order_b", sort_order: 1 },
        { product_id: "prod_order_a", sort_order: 0 },
        { product_id: "prod_order_c", sort_order: 1 },
      ])

      const rows = (await service.listProductEditorials({})).filter((editorial) =>
        editorial.product_id.startsWith("prod_order_"),
      )
      expect(rows).toHaveLength(3)

      const ordered = [...rows].sort(compareProductEditorialOrder)
      expect(ordered.map((editorial) => editorial.sort_order)).toEqual([0, 1, 1])
      expect(ordered[0].product_id).toBe("prod_order_a")

      // `created_at` e `id` son la fuente del desempate; no se fija un orden
      // artificial entre fichas creadas en el mismo lote con ids aleatorios.
      const tied = ordered.filter((editorial) => editorial.sort_order === 1)
      const expectedTied = [...tied].sort((a, b) => {
        const timeA = new Date(a.created_at as Date | string).getTime()
        const timeB = new Date(b.created_at as Date | string).getTime()
        if (timeA !== timeB) return timeA - timeB
        return String(a.id).localeCompare(String(b.id))
      })
      expect(tied.map((editorial) => editorial.id)).toEqual(
        expectedTied.map((editorial) => editorial.id),
      )

      const secondPass = [...ordered].sort(compareProductEditorialOrder)
      expect(secondPass.map((editorial) => editorial.id)).toEqual(
        ordered.map((editorial) => editorial.id),
      )
    })
  },
})
