import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  catalogueCategoryInputSchema,
  normalizeCatalogueInteraction,
  resolveCatalogueCategoryInteractionUpdate,
  updateCatalogueCategorySchema,
} from "@jovy/lib/jovy/catalogue"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { saveCatalogueCategoryWorkflow } from "@jovy/workflows/jovy-catalogue/category"

async function getCategory(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(JOVY_CATALOGUE_MODULE)
  const [category] = await service.listCatalogueCategories({ id: req.params.id })
  if (!category) {
    res.status(404).json({ message: "Categoría de catálogo no encontrada" })
    return null
  }
  // No se hace una mutación de reparación al leer, pero Admin nunca edita ni
  // devuelve la combinación histórica inválida `active + coming_soon`.
  return { ...category, ...normalizeCatalogueInteraction(category) }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const category = await getCategory(req, res)
  if (category) res.json({ category })
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const patch = updateCatalogueCategorySchema.safeParse(req.body)
  if (!patch.success) {
    return res.status(400).json({ message: "La categoría de catálogo no es válida", errors: patch.error.flatten() })
  }

  const current = await getCategory(req, res)
  if (!current) return

  // `null` es una instrucción explícita de limpieza; una clave ausente conserva
  // el valor almacenado. La transición de disponibilidad necesita tanto el
  // estado previo como los campos explícitos de este PATCH lógico.
  const input = catalogueCategoryInputSchema.safeParse({
    ...current,
    ...patch.data,
    ...resolveCatalogueCategoryInteractionUpdate(current, patch.data),
  })
  if (!input.success) {
    return res.status(400).json({ message: "La categoría de catálogo no es válida", errors: input.error.flatten() })
  }

  const { result: category } = await saveCatalogueCategoryWorkflow(req.scope).run({
    input: { id: current.id, ...input.data },
  })
  res.json({ category })
}
