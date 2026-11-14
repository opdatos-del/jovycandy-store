import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { missingCatalogueCategorySeeds, normalizeCatalogueInteraction } from "@jovy/lib/jovy/catalogue"

type SeedResult = { created: number }

/**
 * Crea únicamente las claves ausentes. Es idempotente por clave: volver a
 * ejecutarlo no reescribe ediciones del Admin (nombre, descripción, orden o
 * banderas). El índice único sobre `key` es la última defensa.
 */
const seedCategoriesStep = createStep("seed-categories", async (_, { container }) => {
  const service = container.resolve(JOVY_CATALOGUE_MODULE)
  const existing = await service.listCatalogueCategories({}, { take: 200 })
  const missing = missingCatalogueCategorySeeds(existing.map((category) => category.key))
  if (!missing.length) return new StepResponse<SeedResult>({ created: 0 })

  const created = await service.createCatalogueCategories(
    missing.map((seed) => ({
      key: seed.key,
      name: seed.name,
      sort_order: seed.sort_order,
      ...normalizeCatalogueInteraction({ active: true, coming_soon: false, interaction_locked: false }),
    })),
  )
  return new StepResponse<SeedResult>({ created: created.length })
})

export const seedCatalogueCategoriesWorkflow = createWorkflow(
  "seed-catalogue-categories",
  () => new WorkflowResponse(seedCategoriesStep()),
)
