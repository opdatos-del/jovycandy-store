import type { AuthenticatedMedusaRequest, MedusaNextFunction, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/** La confirmación de invitados usa completeCart; no necesita este GET nativo por ID. */
export async function ensureOwnedStoreOrder(
  req: AuthenticatedMedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: [order] } = await query.graph({
    entity: "order",
    fields: ["id"],
    filters: { id: req.params.id, customer_id: req.auth_context.actor_id, is_draft_order: false },
  })
  if (!order) return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Pedido no encontrado."))
  return next()
}
