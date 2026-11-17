import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { launchAssetIssues, type LaunchInput } from "@jovy/lib/jovy/launches"
import { assertImageFile, type ImageFileLookup } from "@jovy/lib/jovy/media"
import { JOVY_LAUNCHES_MODULE } from "@jovy/modules/jovy-launches"

type LaunchData = LaunchInput & { id?: string }

const saveLaunchStep = createStep("save-launch", async (input: LaunchData, { container }) => {
  const service = container.resolve(JOVY_LAUNCHES_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { id, ...data } = input

  const issues = launchAssetIssues(data)
  if (issues.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `No se puede guardar el lanzamiento. Falta: ${issues.join(", ")}`)
  }

  if (data.product_id) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: { id: data.product_id },
    })
    if (!products.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Producto comercial no encontrado")
  }

  // `null` es una limpieza explícita; cualquier id efectivo debe existir y ser
  // una imagen, incluso si llega heredado de una fila anterior.
  if (data.image_file_id) {
    await assertImageFile(container.resolve(Modules.FILE) as ImageFileLookup, data.image_file_id)
  }

  const launch = id
    ? await service.updateLaunches({ id, ...data })
    : await service.createLaunches(data)
  return new StepResponse(launch)
})

export const saveLaunchWorkflow = createWorkflow(
  "save-launch",
  (input: LaunchData) => new WorkflowResponse(saveLaunchStep(input)),
)

const deleteLaunchStep = createStep("delete-launch", async (input: { id: string }, { container }) => {
  const service = container.resolve(JOVY_LAUNCHES_MODULE)
  await service.softDeleteLaunches(input.id)
  return new StepResponse({ id: input.id })
})

export const deleteLaunchWorkflow = createWorkflow(
  "delete-launch",
  (input: { id: string }) => new WorkflowResponse(deleteLaunchStep(input)),
)

const reorderLaunchesStep = createStep("reorder-launches", async (input: { ids: string[] }, { container }) => {
  const service = container.resolve(JOVY_LAUNCHES_MODULE)
  const launches = await service.listLaunches({ id: input.ids })
  if (launches.length !== input.ids.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No se pueden reordenar lanzamientos inexistentes")
  }
  await Promise.all(input.ids.map((id, sort_order) => service.updateLaunches({ id, sort_order })))
  return new StepResponse({ ids: input.ids })
})

export const reorderLaunchesWorkflow = createWorkflow(
  "reorder-launches",
  (input: { ids: string[] }) => new WorkflowResponse(reorderLaunchesStep(input)),
)
