import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { FamilyInput } from "@jovy/lib/jovy/catalogue"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

type FamilyData = FamilyInput & { id?: string }
type LinkedFamily = { id: string; products?: Array<{ id: string }> | null }

type LinkService = {
  dismiss: (payload: Record<string, Record<string, string>>) => Promise<unknown>
}

const saveFamilyStep = createStep("save-family", async (input: FamilyData, { container }) => {
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

  const [duplicate] = await service.listProductFamilies({ slug: data.slug })
  if (duplicate && duplicate.id !== id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "El slug de familia ya está en uso")
  }

  const family = id
    ? await service.updateProductFamilies({ id, ...data })
    : await service.createProductFamilies(data)
  return new StepResponse(family)
})

export const saveProductFamilyWorkflow = createWorkflow(
  "save-product-family",
  (input: FamilyData) => new WorkflowResponse(saveFamilyStep(input)),
)

const deleteFamilyStep = createStep("delete-family", async (input: { id: string }, { container }) => {
  const service = container.resolve(JOVY_CATALOGUE_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "jovy_product_family",
    fields: ["id", "products.id"],
    filters: { id: input.id },
  })
  const family = data[0] as LinkedFamily | undefined
  if (!family) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Familia no encontrada")

  // Un borrado lógico deja de publicar la familia; los vínculos se retiran para
  // que ningún producto siga resolviendo una familia inexistente. El orden de
  // las claves debe coincidir con el de `defineLink` (familia → producto).
  const link = container.resolve(ContainerRegistrationKeys.LINK) as LinkService
  await Promise.all((family.products ?? []).map((product) =>
    link.dismiss({
      [JOVY_CATALOGUE_MODULE]: { jovy_product_family_id: input.id },
      [Modules.PRODUCT]: { product_id: product.id },
    }),
  ))

  await service.softDeleteProductFamilies(input.id)
  return new StepResponse({ id: input.id })
})

export const deleteProductFamilyWorkflow = createWorkflow(
  "delete-product-family",
  (input: { id: string }) => new WorkflowResponse(deleteFamilyStep(input)),
)

const reorderFamiliesStep = createStep("reorder-families", async (input: { ids: string[] }, { container }) => {
  const service = container.resolve(JOVY_CATALOGUE_MODULE)
  const families = await service.listProductFamilies({ id: input.ids })
  if (families.length !== input.ids.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se pueden reordenar familias inexistentes")
  }
  await Promise.all(input.ids.map((id, sort_order) => service.updateProductFamilies({ id, sort_order })))
  return new StepResponse({ ids: input.ids })
})

export const reorderProductFamiliesWorkflow = createWorkflow(
  "reorder-product-families",
  (input: { ids: string[] }) => new WorkflowResponse(reorderFamiliesStep(input)),
)
