import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { JOVY_MARKETING_MODULE } from "@jovy/modules/jovy-marketing"

type SetHeroProductInput = { hero_id: string; product_id: string | null; actor_id: string | null }
type HeroProductResult = { product_id: string | null; changed: boolean }
export type HeroProductCompensation = { hero_id: string; previous_product_id: string | null; product_id: string | null }
type LinkedHero = { id: string; product?: { id: string } | null }
type ContainerLike = { resolve: (key: string) => unknown }

type LinkService = {
  create: (payload: Record<string, Record<string, string>>) => Promise<unknown>
  dismiss: (payload: Record<string, Record<string, string>>) => Promise<unknown>
}

/**
 * Reverts a Hero/Product link change. Extracted so the unit suite can verify the
 * compensating path without booting a full Medusa container; the step simply
 * delegates to this function.
 */
export async function compensateHeroProductLink(compensation: HeroProductCompensation, container: ContainerLike) {
  const link = container.resolve(ContainerRegistrationKeys.LINK) as LinkService
  if (compensation.product_id) {
    await link.dismiss({
      [Modules.PRODUCT]: { product_id: compensation.product_id },
      [JOVY_MARKETING_MODULE]: { jovy_hero_item_id: compensation.hero_id },
    })
  }

  if (compensation.previous_product_id) {
    await link.create({
      [Modules.PRODUCT]: { product_id: compensation.previous_product_id },
      [JOVY_MARKETING_MODULE]: { jovy_hero_item_id: compensation.hero_id },
    })
  }
}

const setHeroProductStep = createStep<SetHeroProductInput, HeroProductResult, HeroProductCompensation>("set-hero-product", async (input, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "jovy_hero_item", fields: ["id", "product.id"], filters: { id: input.hero_id } })
  const hero = data[0] as LinkedHero | undefined
  if (!hero) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Elemento Hero no encontrado")
  const previousProductId = hero.product?.id ?? null
  if (input.product_id === previousProductId) return new StepResponse({ product_id: previousProductId, changed: false })

  if (input.product_id) {
    const { data: products } = await query.graph({ entity: "product", fields: ["id"], filters: { id: input.product_id } })
    if (!products.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Producto comercial no encontrado")
  }

  const link = container.resolve(ContainerRegistrationKeys.LINK)
  if (previousProductId) await link.dismiss({ [Modules.PRODUCT]: { product_id: previousProductId }, [JOVY_MARKETING_MODULE]: { jovy_hero_item_id: input.hero_id } })
  try {
    if (input.product_id) await link.create({ [Modules.PRODUCT]: { product_id: input.product_id }, [JOVY_MARKETING_MODULE]: { jovy_hero_item_id: input.hero_id } })
  } catch (error) {
    if (previousProductId) await link.create({ [Modules.PRODUCT]: { product_id: previousProductId }, [JOVY_MARKETING_MODULE]: { jovy_hero_item_id: input.hero_id } })
    throw error
  }

  const service = container.resolve(JOVY_MARKETING_MODULE)
  await service.createMarketingAuditLogs({ actor_id: input.actor_id, entity_type: "hero_item", entity_id: input.hero_id, action: "update", metadata: { previous_product_id: previousProductId, product_id: input.product_id } })
  return new StepResponse(
    { product_id: input.product_id, changed: true },
    { hero_id: input.hero_id, previous_product_id: previousProductId, product_id: input.product_id },
  )
}, async (compensation, { container }) => {
  if (!compensation) return
  await compensateHeroProductLink(compensation, container)
})

export const setHeroProductWorkflow = createWorkflow("set-hero-product", (input: SetHeroProductInput) => new WorkflowResponse(setHeroProductStep(input)))
