/**
 * Compatibilidad del catálogo de presentación.
 *
 *   pnpm --dir apps/backend exec medusa exec ./src/scripts/sync-jovy-catalogue.ts
 *
 * 1. Siembra las seis categorías de presentación que falten (nunca pisa ediciones).
 * 2. Deriva familias canónicas desde las Product Categories de Medusa. El
 *    histórico guardaba `family_id` en los productos, columna que no existe en
 *    esta instancia: la Product Category es el único agrupamiento mapeable, así
 *    que no se inventan familias cuando no hay categorías ni productos.
 * 3. Vincula cada producto a la familia de su primera categoría mediante el
 *    Module Link, sin duplicar datos comerciales.
 *
 * La lectura pagina hasta agotar categorías, familias y productos. Un producto
 * nunca recibe una segunda familia: si ya tiene un vínculo distinto se reporta
 * como conflicto y se deja intacto. Es seguro re-ejecutarlo.
 *
 * Este archivo sólo conecta Medusa con `runCatalogueSync`; la orquestación y la
 * regla de "un producto, como máximo una familia" se prueban sin base de datos
 * en `src/lib/jovy/catalogue-sync-run.ts`.
 */
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  collectAllPages,
  type ProductFamilyLink,
  type SyncFamilyRef,
  type SyncProductRef,
} from "@jovy/lib/jovy/catalogue-sync"
import {
  runCatalogueSync,
  type CatalogueSyncCategory,
  type CatalogueSyncLinkedFamily,
} from "@jovy/lib/jovy/catalogue-sync-run"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { saveProductFamilyWorkflow } from "@jovy/workflows/jovy-catalogue/family"
import { seedCatalogueCategoriesWorkflow } from "@jovy/workflows/jovy-catalogue/seed"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    pagination?: {
      take: number
      skip: number
      order?: Record<string, "ASC" | "DESC">
    }
  }) => Promise<{ data: unknown[] }>
}

type LinkService = {
  create: (payload: Record<string, Record<string, string>>) => Promise<unknown>
}

type CatalogueService = {
  listProductFamilies: (filters?: unknown, config?: unknown) => Promise<SyncFamilyRef[]>
  updateProductFamilies: (data: Record<string, unknown>) => Promise<unknown>
}

export default async function syncJovyCatalogue({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const link = container.resolve(ContainerRegistrationKeys.LINK) as LinkService
  const catalogue = container.resolve(JOVY_CATALOGUE_MODULE) as CatalogueService

  await runCatalogueSync({
    logger,
    seedCategories: async () => {
      const seeded = await seedCatalogueCategoriesWorkflow(container).run({ input: {} })
      return { created: seeded.result.created }
    },
    // `order: id ASC` hace determinista la paginación: sin orden explícito
    // PostgreSQL puede devolver filas distintas entre `skip` y `take`.
    listCategories: () =>
      collectAllPages(async (pagination) => {
        const { data } = await query.graph({
          entity: "product_category",
          fields: ["id", "name", "handle", "description", "is_active", "rank"],
          pagination: { ...pagination, order: { id: "ASC" } },
        })
        return data as CatalogueSyncCategory[]
      }),
    listFamilies: () =>
      collectAllPages((pagination) =>
        catalogue.listProductFamilies({}, { ...pagination, order: { id: "ASC" } }),
      ),
    createFamily: async (input) => {
      const { result } = await saveProductFamilyWorkflow(container).run({ input })
      return result as SyncFamilyRef
    },
    mapFamilyToCategory: async ({ family_id, category_id }) => {
      await catalogue.updateProductFamilies({ id: family_id, medusa_category_id: category_id })
    },
    listProducts: () =>
      collectAllPages(async (pagination) => {
        const { data } = await query.graph({
          entity: "product",
          fields: ["id", "categories.id", "categories.rank"],
          pagination: { ...pagination, order: { id: "ASC" } },
        })
        return data as SyncProductRef[]
      }),
    listLinkedFamilies: () =>
      collectAllPages(async (pagination) => {
        const { data } = await query.graph({
          entity: "jovy_product_family",
          fields: ["id", "products.id"],
          pagination: { ...pagination, order: { id: "ASC" } },
        })
        return data as CatalogueSyncLinkedFamily[]
      }),
    createProductFamilyLink: async (pending: ProductFamilyLink) => {
      await link.create({
        [JOVY_CATALOGUE_MODULE]: { jovy_product_family_id: pending.family_id },
        [Modules.PRODUCT]: { product_id: pending.product_id },
      })
    },
  })
}
