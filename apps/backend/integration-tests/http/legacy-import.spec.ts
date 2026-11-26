import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

import manifest from "@jovy/scripts/migrations/jovycandy-legacy/manifest.json"
import importLegacyProducts from "@jovy/scripts/migrations/jovycandy-legacy/import-products"
import seedCommerceLab from "@jovy/scripts/seed-commerce-lab"

jest.mock("@jovy/scripts/migrations/jovycandy-legacy/manifest.json", () =>
  require("./fixtures/legacy-catalog-manifest").default,
)

jest.setTimeout(240_000)
const originalFixture = structuredClone(manifest)

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-legacy-import",
  testSuite: ({ getContainer }) => {
    const originalFetch = global.fetch
    const originalMode = process.env.LEGACY_IMPORT_MODE
    let fetchSpy: jest.SpiedFunction<typeof fetch>

    const query = () =>
      getContainer().resolve(ContainerRegistrationKeys.QUERY) as {
        graph: (input: {
          entity: string
          fields: string[]
          filters?: Record<string, unknown>
          pagination?: { take: number; skip: number }
        }) => Promise<{ data: Array<Record<string, any>> }>
      }

    const runImport = () =>
      importLegacyProducts({ container: getContainer(), args: [] } as ExecArgs)

    const legacyProduct = async () => {
      const { data } = await query().graph({
        entity: "product",
        fields: [
          "id",
          "external_id",
          "handle",
          "title",
          "metadata",
          "sales_channels.id",
          "shipping_profile.id",
          "options.values.value",
          "variants.id",
          "variants.sku",
          "variants.title",
          "variants.weight",
          "variants.manage_inventory",
          "variants.allow_backorder",
          "variants.prices.id",
          "variants.prices.currency_code",
          "variants.prices.amount",
          "variants.inventory_items.inventory_item_id",
        ],
        filters: { external_id: "jovy-mx:test-family:test-product" },
      })
      return data[0]
    }

    beforeAll(() => {
      process.env.LEGACY_IMPORT_MODE = "apply"
      fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, init) => {
          if (String(input).startsWith("https://legacy.test/")) {
            return new Response("fake", {
              status: 200,
              headers: { "content-type": "image/webp" },
            })
          }
          return originalFetch(input, init)
        })
    })

    afterAll(() => {
      fetchSpy.mockRestore()
      if (originalMode === undefined) delete process.env.LEGACY_IMPORT_MODE
      else process.env.LEGACY_IMPORT_MODE = originalMode
    })

    afterEach(() => {
      Object.assign(manifest as any, structuredClone(originalFixture))
    })

    it("no escribe en preview; apply crea una vez y conserva ediciones posteriores", async () => {
      const container = getContainer()
      await seedCommerceLab({ container, args: [] } as ExecArgs)

      const { data: profiles } = await query().graph({
        entity: "shipping_profile",
        fields: ["id"],
        pagination: { take: 1, skip: 0 },
      })
      await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Producto histórico preservado",
              handle: "historical-preserved",
              status: ProductStatus.PUBLISHED,
              shipping_profile_id: String(profiles[0].id),
              options: [{ title: "Presentación", values: ["Única"] }],
              variants: [
                {
                  title: "Única",
                  sku: "HISTORICAL-PRESERVED",
                  options: { Presentación: "Única" },
                  prices: [],
                },
              ],
            },
          ],
        },
      })

      process.env.LEGACY_IMPORT_MODE = "preview"
      await runImport()
      expect(await legacyProduct()).toBeUndefined()

      process.env.LEGACY_IMPORT_MODE = "apply"
      await runImport()
      const created = await legacyProduct()
      expect(created.id).toBeTruthy()
      expect(created.metadata).toMatchObject({ jovy_legacy_managed: true })
      expect(created.metadata).not.toHaveProperty("jovy_official_catalog_complete")
      expect(created.variants).toHaveLength(2)
      const gramsBySku = new Map(
        (manifest as any).products.map((product: any) => [
          `JOVY-MX-${product.source_id}`,
          product.weight_grams,
        ]),
      )
      expect(
        created.variants.every(
          (variant: any) =>
            variant.manage_inventory &&
            !variant.allow_backorder &&
            variant.weight === gramsBySku.get(variant.sku),
        ),
      ).toBe(true)

      const variant = created.variants[0]
      await updateProductsWorkflow(container).run({
        input: { products: [{ id: created.id, title: "Título administrado" }] },
      })
      await updateProductVariantsWorkflow(container).run({
        input: { product_variants: [{ id: variant.id, weight: 999 }] },
      })
      await upsertVariantPricesWorkflow(container).run({
        input: {
          variantPrices: [
            {
              variant_id: variant.id,
              product_id: created.id,
              prices: [{ amount: 999, currency_code: "mxn" }],
            },
          ],
          previousVariantIds: [variant.id],
        },
      })

      await runImport()
      const repeated = await legacyProduct()
      expect(repeated.id).toBe(created.id)
      expect(repeated.title).toBe("Título administrado")
      expect(
        repeated.variants.find((item: any) => item.id === variant.id).weight,
      ).toBe(999)
      expect(
        repeated.variants.find((item: any) => item.id === variant.id).prices,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ currency_code: "mxn", amount: 999 }),
        ]),
      )

      const { data: legacyProducts } = await query().graph({
        entity: "product",
        fields: ["id"],
        filters: { external_id: { $like: "jovy-mx:%" } },
      })
      expect(legacyProducts).toHaveLength(1)
      const { data: historical } = await query().graph({
        entity: "product",
        fields: ["id"],
        filters: { handle: "historical-preserved" },
      })
      expect(historical).toHaveLength(1)
    })

    it("un producto nuevo de Medusa sigue existiendo tras reimportar", async () => {
      const container = getContainer()
      await seedCommerceLab({ container, args: [] } as ExecArgs)
      await runImport()

      await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Producto 36",
              handle: "producto-36",
              status: ProductStatus.PUBLISHED,
              options: [{ title: "Presentación", values: ["Única"] }],
              variants: [
                {
                  title: "Única",
                  sku: "PRODUCTO-36",
                  options: { Presentación: "Única" },
                  prices: [{ amount: 50, currency_code: "mxn" }],
                },
              ],
            },
          ],
        },
      })

      await runImport()
      const { data: newProduct } = await query().graph({
        entity: "product",
        fields: ["id", "handle"],
        filters: { handle: "producto-36" },
      })
      expect(newProduct).toHaveLength(1)
      expect((await legacyProduct()).id).toBeTruthy()
    })
  },
})
