import path from "node:path"

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import manifest from "@jovy/data/catalog/official-mx.json"
import {
  buildOfficialProductPlans,
  officialCatalogSchema,
} from "@jovy/lib/jovy/official-catalog"
import seedCommerceLab from "@jovy/scripts/seed-commerce-lab"
import seedOfficialCatalog from "@jovy/scripts/seed-official-catalog"

jest.setTimeout(360_000)

/**
 * Persistencia real de 35/61 sin red: OFFICIAL_SEED_MEDIA_MODE=manifest usa
 * solamente URLs y hashes ya auditados. La disponibilidad remota se verifica
 * con `catalog:verify-media`, fuera de esta prueba determinista.
 */
medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-official-catalog-full",
  testSuite: ({ getContainer }) => {
    const originalMode = process.env.OFFICIAL_SEED_MODE
    const originalMediaMode = process.env.OFFICIAL_SEED_MEDIA_MODE
    const catalog = officialCatalogSchema.parse(manifest)
    const plans = buildOfficialProductPlans(catalog)

    const query = () =>
      getContainer().resolve(ContainerRegistrationKeys.QUERY) as {
        graph: (input: {
          entity: string
          fields: string[]
          filters?: Record<string, unknown>
          pagination?: { take: number; skip: number }
        }) => Promise<{ data: Array<Record<string, any>> }>
      }

    const runSeed = () =>
      seedOfficialCatalog({ container: getContainer(), args: [] } as ExecArgs)

    beforeAll(() => {
      process.env.OFFICIAL_SEED_MODE = "apply"
      process.env.OFFICIAL_SEED_MEDIA_MODE = "manifest"
    })

    afterAll(() => {
      if (originalMode === undefined) delete process.env.OFFICIAL_SEED_MODE
      else process.env.OFFICIAL_SEED_MODE = originalMode
      if (originalMediaMode === undefined) delete process.env.OFFICIAL_SEED_MEDIA_MODE
      else process.env.OFFICIAL_SEED_MEDIA_MODE = originalMediaMode
    })

    it("persiste 35 productos, 61 variantes, precios MXN, inventario y relaciones sin descargas remotas", async () => {
      const container = getContainer()
      await seedCommerceLab({ container, args: [] } as ExecArgs)
      await runSeed()

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
            product.metadata?.jovy_official_catalog_complete === true &&
            /^[a-f0-9]{64}$/.test(
              String(product.metadata?.jovy_official_catalog_manifest_sha256),
            ) &&
            /^[a-f0-9]{64}$/.test(
              String(product.metadata?.jovy_official_catalog_integrity_sha256),
            ),
        ),
      ).toBe(true)
      expect(
        products.flatMap((product) => product.variants).every(
          (variant) =>
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

      await runSeed()
      const { data: repeated } = await query().graph({
        entity: "product",
        fields: ["id", "variants.id"],
        filters: { external_id: { $like: "jovy-mx:%" } },
        pagination: { take: 100, skip: 0 },
      })
      expect(repeated).toHaveLength(35)
      expect(repeated.flatMap((product) => product.variants)).toHaveLength(61)
      expect(plans).toHaveLength(35)
    })
  },
})
