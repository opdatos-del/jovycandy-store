import path from "node:path"

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

import manifest from "@jovy/scripts/migrations/jovycandy-legacy/manifest.json"
import {
  buildLegacyProductPlans,
  legacyCatalogSchema,
} from "@jovy/lib/jovy/legacy-catalog"
import importLegacyProducts from "@jovy/scripts/migrations/jovycandy-legacy/import-products"
import seedCommerceLab from "@jovy/scripts/seed-commerce-lab"

jest.setTimeout(360_000)

/**
 * Importación real de 35/61 sin red: LEGACY_IMPORT_MEDIA_MODE=manifest usa
 * solamente URLs y hashes ya auditados. La disponibilidad remota se verifica
 * con `legacy:verify-media`, fuera de esta prueba determinista.
 */
medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-legacy-full",
  testSuite: ({ getContainer }) => {
    const originalMode = process.env.LEGACY_IMPORT_MODE
    const originalMediaMode = process.env.LEGACY_IMPORT_MEDIA_MODE
    const catalog = legacyCatalogSchema.parse(manifest)
    const plans = buildLegacyProductPlans(catalog)

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

    beforeAll(() => {
      process.env.LEGACY_IMPORT_MODE = "apply"
      process.env.LEGACY_IMPORT_MEDIA_MODE = "manifest"
    })

    afterAll(() => {
      if (originalMode === undefined) delete process.env.LEGACY_IMPORT_MODE
      else process.env.LEGACY_IMPORT_MODE = originalMode
      if (originalMediaMode === undefined) delete process.env.LEGACY_IMPORT_MEDIA_MODE
      else process.env.LEGACY_IMPORT_MEDIA_MODE = originalMediaMode
    })

    it("importa 35 productos y 61 variantes normales de Medusa sin duplicar", async () => {
      const container = getContainer()
      await seedCommerceLab({ container, args: [] } as ExecArgs)
      await runImport()

      const { data: products } = await query().graph({
        entity: "product",
        fields: [
          "id",
          "external_id",
          "handle",
          "metadata",
          "categories.id",
          "sales_channels.id",
          "shipping_profile.id",
          "variants.sku",
          "variants.weight",
          "variants.manage_inventory",
          "variants.allow_backorder",
          "variants.prices.currency_code",
          "variants.inventory_items.inventory_item_id",
        ],
        filters: { external_id: { $like: "jovy-mx:%" } },
        pagination: { take: 100, skip: 0 },
      })

      expect(products).toHaveLength(35)
      expect(products.flatMap((product) => product.variants)).toHaveLength(61)
      expect(
        products.every(
          (product) =>
            product.categories.length === 1 &&
            product.sales_channels.length === 1 &&
            product.shipping_profile?.id &&
            product.metadata?.jovy_legacy_managed === true &&
            !("jovy_official_catalog_complete" in (product.metadata ?? {})),
        ),
      ).toBe(true)

      const gramsBySku = new Map(
        plans.flatMap((plan) =>
          plan.variants.map((variant) => [variant.sku, variant.grams] as const),
        ),
      )
      expect(
        products.flatMap((product) => product.variants).every(
          (variant) =>
            variant.weight === gramsBySku.get(variant.sku) &&
            variant.manage_inventory === true &&
            variant.allow_backorder === false &&
            variant.inventory_items.length === 1 &&
            variant.prices.some(
              (price: { currency_code?: string }) =>
                price.currency_code?.toLowerCase() === "mxn",
            ),
        ),
      ).toBe(true)

      const { data: inventory } = await query().graph({
        entity: "inventory_item",
        fields: ["sku", "location_levels.stocked_quantity"],
        filters: { sku: { $like: "JOVY-MX-%" } },
        pagination: { take: 100, skip: 0 },
      })
      expect(inventory).toHaveLength(61)
      expect(
        inventory.every(
          (item) =>
            item.location_levels.length === 1 &&
            Number(item.location_levels[0].stocked_quantity) === 50,
        ),
      ).toBe(true)

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
      const { data: repeated } = await query().graph({
        entity: "product",
        fields: ["id", "variants.id"],
        filters: { external_id: { $like: "jovy-mx:%" } },
        pagination: { take: 100, skip: 0 },
      })
      expect(repeated).toHaveLength(35)
      expect(repeated.flatMap((product) => product.variants)).toHaveLength(61)
      const { data: newProduct } = await query().graph({
        entity: "product",
        fields: ["id"],
        filters: { handle: "producto-36" },
      })
      expect(newProduct).toHaveLength(1)
      expect(plans).toHaveLength(35)
    })
  },
})
