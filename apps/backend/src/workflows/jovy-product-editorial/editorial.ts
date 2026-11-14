import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  productPublishIssues,
  resolveEditorialPublishedAt,
  type ProductEditorialInput,
} from "@jovy/lib/jovy/product-editorial"
import {
  fetchEditorialProducts,
  loadEditorialCatalogue,
  type QueryGraph,
} from "@jovy/lib/jovy/product-editorial-graph"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"

/**
 * Guardado editorial. La escritura valida contra el Product Module y, si el
 * estado resultante es `published`, aplica la regla histórica con datos reales:
 * producto existente, categoría de presentación activa, familia, nombre e
 * imagen principal. El gramaje sigue siendo opcional.
 */
type SaveEditorialInput = ProductEditorialInput & { product_id: string }

type EditorialService = {
  listProductEditorials: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => Promise<
    Array<{
      id: string
      deleted_at?: Date | string | null
      editorial_status: string
      published_at?: Date | string | null
    }>
  >
  createProductEditorials: (data: Record<string, unknown>) => Promise<unknown>
  updateProductEditorials: (data: Record<string, unknown>) => Promise<unknown>
  softDeleteProductEditorials: (id: string) => Promise<unknown>
  restoreProductEditorials: (id: string) => Promise<unknown>
}

const saveProductEditorialStep = createStep(
  "save-product-editorial",
  async (input: SaveEditorialInput, { container }) => {
    const service = container.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
    const { product_id, ...patch } = input

    const product = (await fetchEditorialProducts(query, [product_id])).get(product_id)
    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Producto comercial no encontrado")
    }

    // Una ficha borrada lógicamente no se resucita con un guardado implícito:
    // la restauración es una acción explícita (`/editorial/restore`) y así el
    // índice único parcial no se puede violar por accidente.
    const [existing] = await service.listProductEditorials({ product_id }, { withDeleted: true })
    if (existing?.deleted_at) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "La ficha editorial está eliminada; restáurala antes de guardarla",
      )
    }

    const editorialStatus = patch.editorial_status ?? existing?.editorial_status ?? "draft"
    if (editorialStatus === "published") {
      const catalogue = await loadEditorialCatalogue(container)
      const issues = productPublishIssues(product, catalogue.categories, catalogue.families)
      if (issues.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `No se puede publicar el producto. Falta: ${issues.join(", ")}`,
        )
      }
    }

    const data: Record<string, unknown> = {
      ...patch,
      editorial_status: editorialStatus,
      // Guardar una ficha ya publicada no reescribe la fecha de publicación:
      // solo la transición a `published` la establece.
      published_at: resolveEditorialPublishedAt(existing, editorialStatus),
    }
    // Un gramaje vacío se guarda como ausencia de dato, no como cadena vacía.
    if (patch.gramaje !== undefined) data.gramaje = patch.gramaje?.trim() || null

    const editorial = existing
      ? await service.updateProductEditorials({ id: existing.id, ...data })
      : await service.createProductEditorials({
          product_id,
          gramaje: null,
          certifications: [],
          sort_order: 0,
          is_new: false,
          ...data,
        })

    return new StepResponse(editorial)
  },
)

export const saveProductEditorialWorkflow = createWorkflow(
  "save-product-editorial",
  (input: SaveEditorialInput) => new WorkflowResponse(saveProductEditorialStep(input)),
)

const deleteProductEditorialStep = createStep(
  "delete-product-editorial",
  async (input: { product_id: string }, { container }) => {
    const service = container.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService
    const [existing] = await service.listProductEditorials({ product_id: input.product_id })
    if (!existing) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "El producto no tiene ficha editorial")
    }

    await service.softDeleteProductEditorials(existing.id)
    return new StepResponse({ id: existing.id })
  },
)

export const deleteProductEditorialWorkflow = createWorkflow(
  "delete-product-editorial",
  (input: { product_id: string }) => new WorkflowResponse(deleteProductEditorialStep(input)),
)

/**
 * Restauración segura: solo la ficha editorial. El producto comercial nunca se
 * toca y debe seguir existiendo en el Product Module para poder recuperarla.
 */
const restoreProductEditorialStep = createStep(
  "restore-product-editorial",
  async (input: { product_id: string }, { container }) => {
    const service = container.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph

    const product = (await fetchEditorialProducts(query, [input.product_id])).get(input.product_id)
    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Producto comercial no encontrado")
    }

    const [existing] = await service.listProductEditorials({ product_id: input.product_id }, { withDeleted: true })
    if (!existing) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "El producto no tiene ficha editorial")
    }

    if (existing.deleted_at) await service.restoreProductEditorials(existing.id)
    const [restored] = await service.listProductEditorials({ id: existing.id })
    return new StepResponse(restored)
  },
)

export const restoreProductEditorialWorkflow = createWorkflow(
  "restore-product-editorial",
  (input: { product_id: string }) => new WorkflowResponse(restoreProductEditorialStep(input)),
)
