import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : ""
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "status"],
    pagination: { take: 100, skip: 0 },
  })
  const normalized = q.toLocaleLowerCase()
  const products = data.filter((product) => !normalized
    || product.title?.toLocaleLowerCase().includes(normalized)
    || product.handle?.toLocaleLowerCase().includes(normalized)).slice(0, 20)
  res.json({ products })
}
