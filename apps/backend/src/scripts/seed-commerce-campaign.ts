/**
 * Prepara una campaña comercial de laboratorio con funcionalidades nativas de
 * Medusa:
 *
 *   pnpm --dir apps/backend seed:campaign
 *
 * - una Price List de tipo `sale` con precios temporales por variante;
 * - un cupón porcentual, un cupón de importe fijo y un cupón de envío gratis;
 * - una promoción automática limitada al conjunto de variantes de laboratorio;
 * - una campaña nativa que agrupa vigencias y presupuesto.
 *
 * No toca precios base ni inventario; no publica nada en producción. Es
 * idempotente por identificador de campaña y por código de promoción.
 *
 * Guardas: rechaza producción, staging, bases no loopback y bases locales sin
 * huella autorizada. Un PostgreSQL efímero verificable se acepta por su
 * marcador de ejecución.
 */
import {
  createCampaignsWorkflow,
  createPriceListsWorkflow,
  createPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  assertLabCampaignDatabase,
  campaignTargetRules,
  parseLabDatabaseIdentity,
  resolveLabCampaignConfig,
  selectCampaignVariants,
  type CampaignProductRow,
} from "@jovy/lib/jovy/lab-campaign"
import type { QueryGraph } from "@jovy/lib/jovy/product-editorial-graph"

const CURRENCY = "mxn"

function campaignDates(config: ReturnType<typeof resolveLabCampaignConfig>) {
  return { startsAt: config.startsAt, endsAt: config.endsAt }
}

async function seedCampaign({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  // Toda la validación ocurre antes de la primera escritura. La identidad de
  // la base se comprueba antes de interpretar la configuración de campaña.
  const identity = parseLabDatabaseIdentity(process.env.DATABASE_URL)
  assertLabCampaignDatabase(process.env, identity)
  const config = resolveLabCampaignConfig(process.env)
  const { startsAt, endsAt } = campaignDates(config)

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "status",
      "variants.id",
      "variants.sku",
      "variants.price_set.id",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.currency_code",
    ],
    filters: { status: "published" },
    pagination: { take: 1_000, skip: 0 },
  })

  const selected = selectCampaignVariants(
    products as CampaignProductRow[],
    config.requestedSkus,
    config.variantLimit,
    CURRENCY,
  )
  const selectedProductIds = [...new Set(selected.map((variant) => variant.productId))]
  const targetRules = campaignTargetRules(selectedProductIds)

  const existingCampaign = (await query.graph({
    entity: "campaign",
    fields: ["id", "name", "campaign_identifier"],
    filters: { campaign_identifier: config.campaignIdentifier },
    pagination: { take: 1, skip: 0 },
  })).data[0] as { id: string } | undefined

  let campaignId: string | undefined = existingCampaign?.id
  if (!campaignId) {
    const { result } = await createCampaignsWorkflow(container).run({
      input: {
        campaignsData: [
          {
            name: config.campaignName,
            campaign_identifier: config.campaignIdentifier,
            description:
              "Campaña de laboratorio. No representa una promoción comercial publicada.",
            starts_at: startsAt,
            ends_at: endsAt,
          },
        ],
      },
    })
    campaignId = result[0].id
    if (!campaignId) throw new Error("La campaña no devolvió un identificador.")
    logger.info(`[jovy-campaign] campaña creada: ${config.campaignName}`)
  } else {
    logger.info(`[jovy-campaign] campaña reutilizada: ${config.campaignName}`)
  }

  const priceListTitle = `${config.campaignName} - Precios`
  const existingPriceList = (await query.graph({
    entity: "price_list",
    fields: ["id", "title"],
    filters: { title: priceListTitle },
    pagination: { take: 1, skip: 0 },
  })).data[0] as { id: string } | undefined

  if (!existingPriceList) {
    const discounts = selected.map((variant) => ({
      variant_id: variant.id,
      currency_code: CURRENCY,
      amount: Math.max(
        1,
        Math.round(variant.baseAmount * (1 - config.salePercent / 100)),
      ),
    }))

    // Los tipos publicados del workflow y su entrada real de Admin difieren en
    // esta versión; la forma usada aquí es la misma que valida la API Admin.
    await createPriceListsWorkflow(container).run({
      input: {
        price_lists_data: [
          {
            title: priceListTitle,
            description: `Precios de oferta de ${config.campaignName}. Solo laboratorio.`,
            type: "sale",
            status: "active",
            starts_at: startsAt,
            ends_at: endsAt,
            prices: discounts,
          },
        ],
      } as never,
    })
    logger.info(
      `[jovy-campaign] price list creada con ${discounts.length} variantes (-${config.salePercent}%)`,
    )
  } else {
    logger.info("[jovy-campaign] price list ya existía; no se modificó")
  }

  const promotionCodes = [
    config.codes.percent,
    config.codes.fixed,
    config.codes.automatic,
    config.codes.shipping,
  ]

  const existingPromotions = (await query.graph({
    entity: "promotion",
    fields: ["id", "code"],
    filters: { code: promotionCodes },
    pagination: { take: 100, skip: 0 },
  })).data as Array<{ code: string }>
  const existingCodes = new Set(existingPromotions.map((promotion) => promotion.code))

  const promotionsData = [
    {
      code: config.codes.percent,
      type: "standard",
      status: "active",
      campaign_id: campaignId,
      metadata: { jovy_lab: true },
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: config.couponPercent,
        currency_code: CURRENCY,
        target_rules: targetRules,
      },
    },
    {
      code: config.codes.fixed,
      type: "standard",
      status: "active",
      campaign_id: campaignId,
      metadata: { jovy_lab: true },
      application_method: {
        type: "fixed",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: config.fixedAmount,
        currency_code: CURRENCY,
        target_rules: targetRules,
      },
    },
    {
      code: config.codes.automatic,
      type: "standard",
      status: "active",
      is_automatic: true,
      campaign_id: campaignId,
      metadata: { jovy_lab: true },
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: config.automaticPercent,
        currency_code: CURRENCY,
        target_rules: targetRules,
      },
    },
    {
      code: config.codes.shipping,
      type: "standard",
      status: "active",
      campaign_id: campaignId,
      metadata: { jovy_lab: true },
      application_method: {
        type: "percentage",
        target_type: "shipping_methods",
        allocation: "across",
        value: 100,
        currency_code: CURRENCY,
      },
    },
  ].filter((promotion) => !existingCodes.has(promotion.code))

  if (promotionsData.length) {
    await createPromotionsWorkflow(container).run({
      input: { promotionsData } as never,
    })
    logger.info(
      `[jovy-campaign] promociones creadas: ${promotionsData
        .map((promotion) => promotion.code)
        .join(", ")}`,
    )
  } else {
    logger.info("[jovy-campaign] las promociones ya existían; no se modificaron")
  }

  logger.info(
    `[jovy-campaign] listo. ${selected.length} variantes, base ${identity.database}@${identity.host}:${identity.port}, vigencia ${startsAt.toISOString()} → ${endsAt.toISOString()}. Solo laboratorio.`,
  )
}

export default async function seedCommerceCampaign(args: ExecArgs) {
  await seedCampaign(args)
}
