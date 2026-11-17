import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { normalizeCatalogueInteraction, type UpdateCatalogueCategoryInput } from "@jovy/lib/jovy/catalogue"
import { assertImageFile, type ImageFileLookup } from "@jovy/lib/jovy/media"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

type SaveCategoryInput = UpdateCatalogueCategoryInput & {
  id: string
  name: string
  active: boolean
  coming_soon: boolean
  interaction_locked: boolean
  sort_order: number
}

const saveCategoryStep = createStep("save-category", async (input: SaveCategoryInput, { container }) => {
  const service = container.resolve(JOVY_CATALOGUE_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { id, ...data } = input

  if (data.medusa_category_id) {
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: ["id"],
      filters: { id: data.medusa_category_id },
    })
    if (!categories.length) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Categoría comercial no encontrada")
    }
  }

  // `null` quita la imagen; un id efectivo debe existir en el File Module y
  // ser una imagen antes de tocar la fila.
  if (data.image_file_id) {
    await assertImageFile(container.resolve(Modules.FILE) as ImageFileLookup, data.image_file_id)
  }

  const category = await service.updateCatalogueCategories({
    id,
    ...data,
    ...normalizeCatalogueInteraction(data),
  })
  return new StepResponse(category)
})

export const saveCatalogueCategoryWorkflow = createWorkflow(
  "save-catalogue-category",
  (input: SaveCategoryInput) => new WorkflowResponse(saveCategoryStep(input)),
)

const reorderCategoriesStep = createStep("reorder-categories", async (input: { ids: string[] }, { container }) => {
  const service = container.resolve(JOVY_CATALOGUE_MODULE)
  const categories = await service.listCatalogueCategories({ id: input.ids })
  if (categories.length !== input.ids.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se pueden reordenar categorías inexistentes")
  }
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  await Promise.all(input.ids.map((id, sort_order) => {
    const category = categoriesById.get(id)!
    // Reordenar también es una escritura: corrige el estado efectivo de una
    // fila histórica sin tocar las categorías que no participan.
    return service.updateCatalogueCategories({
      id,
      sort_order,
      ...normalizeCatalogueInteraction(category),
    })
  }))
  return new StepResponse({ ids: input.ids })
})

export const reorderCatalogueCategoriesWorkflow = createWorkflow(
  "reorder-catalogue-categories",
  (input: { ids: string[] }) => new WorkflowResponse(reorderCategoriesStep(input)),
)
