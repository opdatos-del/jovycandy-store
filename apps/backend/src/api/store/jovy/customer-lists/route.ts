import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MAX_CUSTOM_LISTS, mutateCustomerList } from "@jovy/workflows/jovy-customer-space/lists"
import type { CustomerListMutation } from "./middlewares"

type ListRow = {
  id: string
  name: string | null
  items: Array<{
    id: string
    product_variant?: {
      id: string
      title: string
      product?: { id: string; title: string; handle: string; status: string; sales_channels?: Array<{ id: string }> }
    }
  }>
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const channelIds = req.publishable_key_context?.sales_channel_ids ?? []
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "jovy_wishlist",
    fields: [
      "id", "name", "items.id", "items.product_variant.id", "items.product_variant.title",
      "items.product_variant.product.id", "items.product_variant.product.title", "items.product_variant.product.handle",
      "items.product_variant.product.status", "items.product_variant.product.sales_channels.id",
    ],
    filters: { customer_id: req.auth_context.actor_id },
    pagination: { take: MAX_CUSTOM_LISTS + 1, order: { created_at: "ASC" } },
  })
  const lists = (data as unknown as ListRow[]).map((list) => ({
    id: list.name === null ? "favorites" : list.id,
    name: list.name,
    items: (list.items ?? []).map(({ id, product_variant: variant }) => {
      const product = variant?.product
      const available = product?.status === "published" && product.sales_channels?.some(({ id }) => channelIds.includes(id))
      return {
        id,
        variant: available && variant && product ? {
          id: variant.id, title: variant.title,
          product: { id: product.id, title: product.title, handle: product.handle },
        } : null,
      }
    }),
  }))
  const favorites = lists.find((list) => list.id === "favorites") ?? { id: "favorites", name: null, items: [] }
  return res.json({ lists: [favorites, ...lists.filter((list) => list.id !== "favorites")] })
}

export async function POST(req: AuthenticatedMedusaRequest<CustomerListMutation>, res: MedusaResponse) {
  const { result } = await mutateCustomerList(req.scope).run({ input: {
    customerId: req.auth_context.actor_id,
    channelIds: req.publishable_key_context?.sales_channel_ids ?? [],
    mutation: req.validatedBody,
  } })
  return res.json(result)
}
