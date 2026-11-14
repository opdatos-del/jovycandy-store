import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { buildJovyDashboard } from "@jovy/lib/jovy/dashboard"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const dashboard = await buildJovyDashboard(req.scope)
  res.json(dashboard)
}
