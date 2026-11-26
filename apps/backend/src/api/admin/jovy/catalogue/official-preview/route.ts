import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import manifest from "@jovy/data/catalog/official-mx.json"
import {
  buildOfficialProductPlans,
  officialCatalogSchema,
  validateOfficialCatalog,
} from "@jovy/lib/jovy/official-catalog"
import {
  buildOfficialCatalogPreview,
  OFFICIAL_CATALOG_APPROVABLE_FIELDS,
  officialCatalogPatchForFields,
  type OfficialCatalogApprovableField,
  type OfficialCatalogPreviewProduct,
} from "@jovy/lib/jovy/official-catalog-preview"

const approvalSchema = z.object({
  updates: z
    .array(
      z.object({
        external_id: z.string().regex(/^jovy-mx:/),
        fields: z
          .array(z.enum(OFFICIAL_CATALOG_APPROVABLE_FIELDS))
          .min(1)
          .max(OFFICIAL_CATALOG_APPROVABLE_FIELDS.length),
      }),
    )
    .min(1)
    .max(35),
})

type Query = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number }
  }) => Promise<{ data: Array<Record<string, unknown>> }>
}

function plans() {
  const catalog = officialCatalogSchema.parse(manifest)
  validateOfficialCatalog(catalog)
  return buildOfficialProductPlans(catalog)
}

async function loadProducts(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as Query
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "external_id",
      "title",
      "description",
      "weight",
      "status",
      "metadata",
      "categories.handle",
      "variants.sku",
      "variants.title",
      "variants.metadata",
      "variants.prices.currency_code",
      "variants.prices.amount",
    ],
    filters: { external_id: { $like: "jovy-mx:%" } },
    pagination: { take: 100, skip: 0 },
  })
  // Un producto histórico con external_id oficial no se ofrece para aprobación.
  return data.filter((product) => {
    const metadata = product.metadata as Record<string, unknown> | null | undefined
    return metadata?.jovy_official_managed === true
  }) as unknown as OfficialCatalogPreviewProduct[]
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({ preview: buildOfficialCatalogPreview(plans(), await loadProducts(req)) })
}

/**
 * Aplica sólo campos comerciales seleccionados. Inventario, precio, variantes,
 * medios y metadata siguen reservados a las reglas idempotentes del seed.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = approvalSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Las aprobaciones del catálogo no son válidas",
      errors: parsed.error.flatten(),
    })
  }

  const sourcePlans = new Map(plans().map((plan) => [plan.externalId, plan]))
  const products = new Map(
    (await loadProducts(req)).map((product) => [String(product.external_id), product]),
  )
  const updates: Array<Record<string, unknown>> = []
  const seen = new Set<string>()
  for (const approval of parsed.data.updates) {
    if (seen.has(approval.external_id)) {
      return res.status(400).json({ message: "Un producto fue aprobado más de una vez" })
    }
    seen.add(approval.external_id)
    const plan = sourcePlans.get(approval.external_id)
    const product = products.get(approval.external_id)
    if (!plan || !product) {
      return res.status(404).json({
        message: `No existe producto oficial para ${approval.external_id}`,
      })
    }
    updates.push({
      id: product.id,
      ...officialCatalogPatchForFields(
        plan,
        approval.fields as OfficialCatalogApprovableField[],
      ),
    })
  }

  await updateProductsWorkflow(req.scope).run({ input: { products: updates } })
  res.json({
    updated: updates.length,
    preview: buildOfficialCatalogPreview(plans(), await loadProducts(req)),
  })
}
