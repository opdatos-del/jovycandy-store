import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import type { CustomerListMutation } from "@jovy/api/store/jovy/customer-lists/middlewares"
import { JOVY_CUSTOMER_SPACE_MODULE } from "@jovy/modules/jovy-customer-space"
import type CustomerSpaceService from "@jovy/modules/jovy-customer-space/service"

export const MAX_CUSTOM_LISTS = 12
const MAX_LIST_ITEMS = 100

type Input = { customerId: string; channelIds: string[]; mutation: CustomerListMutation }

const applyCustomerListMutation = createStep("apply-customer-list-mutation", async (input: Input, { container }) => {
  const service: CustomerSpaceService = container.resolve(JOVY_CUSTOMER_SPACE_MODULE)
  const lock = container.resolve(Modules.LOCKING)
  const { customerId, mutation } = input
  const result = await lock.execute(`jovy:customer-lists:${customerId}`, async () => {
    if (mutation.action === "create") {
      const [, count] = await service.listAndCountJovyWishlists({ customer_id: customerId, name: { $ne: null } }, { take: 1 })
      if (count >= MAX_CUSTOM_LISTS) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Alcanzaste el límite de listas.")
      const list = await service.createJovyWishlists({ customer_id: customerId, name: mutation.name })
      return { id: list.id }
    }

    const favorites = mutation.list_id === "favorites"
    let [list] = await service.listJovyWishlists({
      customer_id: customerId,
      ...(favorites ? { name: null } : { id: mutation.list_id }),
    }, { take: 1 })
    if (!list && !(favorites && mutation.action === "add")) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Lista no encontrada.")
    }
    if (mutation.action === "add") {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "variant",
        fields: ["id", "product.status", "product.sales_channels.id"],
        filters: { id: mutation.variant_id },
      })
      const variant = data[0] as { product?: { status: string; sales_channels?: Array<{ id: string }> } } | undefined
      if (variant?.product?.status !== "published" ||
          !variant.product.sales_channels?.some(({ id }) => input.channelIds.includes(id))) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Presentación no disponible.")
      }
      list ??= await service.createJovyWishlists({ customer_id: customerId, name: null })
      const [existing] = await service.listJovyWishlistItems({
        wishlist_id: list.id, product_variant_id: mutation.variant_id,
      }, { take: 1 })
      if (existing) return { id: existing.id }
      const [, count] = await service.listAndCountJovyWishlistItems({ wishlist_id: list.id }, { take: 1 })
      if (count >= MAX_LIST_ITEMS) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "La lista está llena.")
      const item = await service.createJovyWishlistItems({ wishlist_id: list.id, product_variant_id: mutation.variant_id })
      return { id: item.id }
    }
    if (!list) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Lista no encontrada.")
    if (mutation.action === "remove") {
      const [item] = await service.listJovyWishlistItems({ id: mutation.item_id, wishlist_id: list.id }, { take: 1 })
      if (!item) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Artículo no encontrado.")
      await service.deleteJovyWishlistItems(item.id)
      return { id: item.id }
    }
    if (list.name === null) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "No se puede cambiar la lista de favoritos.")
    if (mutation.action === "rename") await service.updateJovyWishlists({ id: list.id, name: mutation.name })
    else await service.deleteJovyWishlists(list.id)
    return { id: list.id }
  })
  return new StepResponse(result)
})

export const mutateCustomerList = createWorkflow("mutate-customer-list", function (input: Input) {
  return new WorkflowResponse(applyCustomerListMutation(input))
})
