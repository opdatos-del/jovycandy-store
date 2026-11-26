/**
 * Prepara una campaña comercial de laboratorio con funcionalidades nativas de
 * Medusa:
 *
 *   pnpm --dir apps/backend seed:campaign
 *
 * - una Price List de tipo `sale` con precios temporales por variante;
 * - un cupón porcentual, un cupón de importe fijo y un cupón de envío gratis;
 * - una promoción automática;
 * - una campaña nativa que agrupa vigencias y presupuesto.
 *
 * No toca precios base ni inventario; no publica nada en producción. Es
 * idempotente por identificador de campaña y por código de promoción. Las
 * fechas se pueden ajustar con `JOVY_CAMPAIGN_START` y `JOVY_CAMPAIGN_END`.
 */
import {
  createCampaignsWorkflow,
  createPriceListsWorkflow,
  createPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { QueryGraph } from "@jovy/lib/jovy/product-editorial-graph"

const CAMPAIGN_IDENTIFIER =
  process.env.JOVY_CAMPAIGN_IDENTIFIER ?? "buen-fin-laboratorio"
const CAMPAIGN_NAME = process.env.JOVY_CAMPAIGN_NAME ?? "Buen Fin Laboratorio"
const CURRENCY = "mxn"
const SALE_PERCENT = Number(process.env.JOVY_CAMPAIGN_SALE_PERCENT ?? "20")
const VARIANT_LIMIT = Number(process.env.JOVY_CAMPAIGN_VARIANT_LIMIT ?? "5")
const PRICE_LIST_TITLE = `${CAMPAIGN_NAME} - Precios`

function campaignDates() {
  const startsAt = process.env.JOVY_CAMPAIGN_START
    ? new Date(process.env.JOVY_CAMPAIGN_START)
    : new Date()
  const endsAt = process.env.JOVY_CAMPAIGN_END
    ? new Date(process.env.JOVY_CAMPAIGN_END)
    : new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1_000)
  return { startsAt, endsAt }
}

type VariantRow = {
  id: string
  sku?: string | null
  price_set?: {
    id?: string | null
    prices?: Array<{ amount?: number | null; currency_code?: string | null }> | null
  } | null
}

type ProductRow = {
  id: string
  variants?: VariantRow[] | null
}

async function seedCampaign({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const { startsAt, endsAt } = campaignDates()

  const existingCampaign = (await query.graph({
    entity: "campaign",
    fields: ["id", "name", "campaign_identifier"],
    filters: { campaign_identifier: CAMPAIGN_IDENTIFIER },
    pagination: { take: 1, skip: 0 },
  })).data[0] as { id: string } | undefined

  let campaignId: string | undefined = existingCampaign?.id
  if (!campaignId) {
    const { result } = await createCampaignsWorkflow(container).run({
      input: {
        campaignsData: [
          {
            name: CAMPAIGN_NAME,
            campaign_identifier: CAMPAIGN_IDENTIFIER,
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
    logger.info(`[jovy-campaign] campaña creada: ${CAMPAIGN_NAME}`)
  } else {
    logger.info(`[jovy-campaign] campaña reutilizada: ${CAMPAIGN_NAME}`)
  }

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

  const requestedSkus = (process.env.JOVY_CAMPAIGN_SKUS ?? "")
    .split(",")
    .map((sku) => sku.trim().toUpperCase())
    .filter(Boolean)

  const variantRows = (products as ProductRow[])
    .flatMap((product) => product.variants ?? [])
    .filter((variant) => {
      const price = (variant.price_set?.prices ?? []).find(
        (item) => String(item.currency_code).toLowerCase() === CURRENCY,
      )
      return Boolean(
        variant.id &&
          variant.price_set?.id &&
          typeof price?.amount === "number" &&
          price.amount > 0,
      )
    })
    .filter(
      (variant) =>
        !requestedSkus.length ||
        requestedSkus.includes(String(variant.sku ?? "").toUpperCase()),
    )
    .slice(0, Math.max(1, VARIANT_LIMIT))

  const existingPriceList = (await query.graph({
    entity: "price_list",
    fields: ["id", "title"],
    filters: { title: PRICE_LIST_TITLE },
    pagination: { take: 1, skip: 0 },
  })).data[0] as { id: string } | undefined

  if (!existingPriceList && variantRows.length) {
    const discounts = variantRows.map((variant) => {
      const price = (variant.price_set?.prices ?? []).find(
        (item) => String(item.currency_code).toLowerCase() === CURRENCY,
      )
      const baseAmount = Number(price?.amount ?? 0)
      return {
        variant_id: variant.id,
        currency_code: CURRENCY,
        amount: Math.max(1, Math.round(baseAmount * (1 - SALE_PERCENT / 100))),
      }
    })

    // Los tipos publicados del workflow y su entrada real de Admin difieren en
    // esta versión; la forma usada aquí es la misma que valida la API Admin.
    await createPriceListsWorkflow(container).run({
      input: {
        price_lists_data: [
          {
            title: PRICE_LIST_TITLE,
            description: `Precios de oferta de ${CAMPAIGN_NAME}. Solo laboratorio.`,
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
      `[jovy-campaign] price list creada con ${discounts.length} variantes (-${SALE_PERCENT}%)`,
    )
  } else if (existingPriceList) {
    logger.info("[jovy-campaign] price list ya existía; no se modificó")
  } else {
    logger.warn("[jovy-campaign] no hay variantes con precio MXN; price list omitida")
  }

  const promotionCodes = [
    process.env.JOVY_CAMPAIGN_CODE_PERCENT ?? "BUENFIN10",
    process.env.JOVY_CAMPAIGN_CODE_FIXED ?? "BUENFIN50",
    process.env.JOVY_CAMPAIGN_CODE_AUTO ?? "AUTO15",
    process.env.JOVY_CAMPAIGN_CODE_SHIPPING ?? "ENVIOGRATIS",
  ].map((code) => code.toUpperCase())

  const existingPromotions = (await query.graph({
    entity: "promotion",
    fields: ["id", "code"],
    filters: { code: promotionCodes },
    pagination: { take: 100, skip: 0 },
  })).data as Array<{ code: string }>
  const existingCodes = new Set(existingPromotions.map((promotion) => promotion.code))

  const promotionsData = [
    {
      code: promotionCodes[0],
      type: "standard",
      status: "active",
      campaign_id: campaignId,
      metadata: { jovy_lab: true },
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: 10,
        currency_code: CURRENCY,
      },
    },
    {
      code: promotionCodes[1],
      type: "standard",
      status: "active",
      campaign_id: campaignId,
      metadata: { jovy_lab: true },
      application_method: {
        type: "fixed",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: 50,
        currency_code: CURRENCY,
      },
    },
    {
      code: promotionCodes[2],
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
        value: 15,
        currency_code: CURRENCY,
      },
    },
    {
      code: promotionCodes[3],
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
    `[jovy-campaign] listo. Vigencia ${startsAt.toISOString()} → ${endsAt.toISOString()}. Solo laboratorio.`,
  )
}

export default async function seedCommerceCampaign(args: ExecArgs) {
  await seedCampaign(args)
}
