/**
 * Prepara la infraestructura comercial mínima de laboratorio:
 *
 *   pnpm --dir apps/backend seed:commerce
 *
 * - agrega MXN a la tienda si falta;
 * - crea/verifica la región México;
 * - crea la región fiscal de México;
 * - reutiliza el stock location y el shipping profile existentes;
 * - crea una zona de fulfillment y opciones de envío DEMO para México;
 * - deja disponible `pp_system_default` (pago manual de Medusa).
 *
 * No crea pagos reales, no modifica pedidos y es idempotente.
 */
import {
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number }
  }) => Promise<{ data: unknown[] }>
}

type FulfillmentService = {
  listFulfillmentSets: (filters?: unknown, config?: unknown) => Promise<Array<{ id: string; name?: string }>>
  createFulfillmentSets: (data: Record<string, unknown>) => Promise<{ id: string; service_zones?: Array<{ id: string }> }>
  listShippingOptions: (filters?: unknown, config?: unknown) => Promise<Array<{ id: string; name: string }>>
}

type TaxService = {
  listTaxRegions: (filters?: unknown) => Promise<Array<{ id: string; country_code?: string | null }>>
  createTaxRegions: (data: Record<string, unknown>) => Promise<unknown>
}

type LinkService = {
  create: (payload: Record<string, Record<string, string>>) => Promise<unknown>
}

const REGION_NAME = "Mexico"
const CURRENCY = "mxn"
const COUNTRY = "mx"
const FULFILLMENT_SET_NAME = "Jovy Mexico Lab delivery"

export default async function seedCommerceLab({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const link = container.resolve(ContainerRegistrationKeys.LINK) as LinkService
  const fulfillment = container.resolve(Modules.FULFILLMENT) as unknown as FulfillmentService
  const tax = container.resolve(Modules.TAX) as unknown as TaxService

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  })
  const store = stores[0] as
    | { id: string; supported_currencies?: Array<{ currency_code?: string | null }> }
    | undefined
  if (!store) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No hay store configurada.")

  const currencies = (store.supported_currencies ?? [])
    .map((currency) => currency.currency_code?.toLowerCase())
    .filter((value): value is string => Boolean(value))

  if (!currencies.includes(CURRENCY)) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          supported_currencies: [
            ...currencies.map((currency_code) => ({
              currency_code,
              is_default: currency_code === currencies[0],
            })),
            { currency_code: CURRENCY, is_default: false },
          ],
        },
      },
    })
    logger.info(`[jovy-commerce] moneda ${CURRENCY.toUpperCase()} agregada a la tienda`)
  }

  const { data: regionRows } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })
  let region = (regionRows as Array<{
    id: string
    name: string
    currency_code: string
    countries?: Array<{ iso_2?: string | null }> | null
  }>).find(
    (item) =>
      item.currency_code === CURRENCY ||
      (item.countries ?? []).some((country) => country.iso_2 === COUNTRY),
  )

  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: CURRENCY,
            countries: [COUNTRY],
            payment_providers: ["pp_system_default"],
            metadata: { jovy_lab: true, demo_payment: true },
          },
        ],
      },
    })
    region = result[0]
    logger.info(`[jovy-commerce] región ${REGION_NAME} creada`)
  } else {
    logger.info(`[jovy-commerce] región ${region.name} reutilizada`)
  }

  const taxRegions = await tax.listTaxRegions({ country_code: COUNTRY })
  if (!taxRegions.length) {
    await tax.createTaxRegions({ country_code: COUNTRY, provider_id: "tp_system" })
    logger.info(`[jovy-commerce] región fiscal ${COUNTRY} creada`)
  }

  const { data: stockLocationRows } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    pagination: { take: 1, skip: 0 },
  })
  const stockLocation = stockLocationRows[0] as { id: string; name: string } | undefined
  if (!stockLocation) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No hay stock location. Ejecuta el seed inicial de Medusa.",
    )
  }

  const { data: shippingProfileRows } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
    pagination: { take: 1, skip: 0 },
  })
  const shippingProfile = shippingProfileRows[0] as { id: string } | undefined
  if (!shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No hay shipping profile. Ejecuta el seed inicial de Medusa.",
    )
  }

  let [fulfillmentSet] = await fulfillment.listFulfillmentSets({ name: FULFILLMENT_SET_NAME })
  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillment.createFulfillmentSets({
      name: FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [
        {
          name: "Mexico",
          geo_zones: [{ country_code: COUNTRY, type: "country" }],
        },
      ],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info("[jovy-commerce] fulfillment set México creado")
  }

  const { data: fulfillmentSetRows } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "service_zones.id"],
    filters: { id: fulfillmentSet.id },
  })
  const serviceZoneId = (
    fulfillmentSetRows[0] as { service_zones?: Array<{ id: string }> } | undefined
  )?.service_zones?.[0]?.id

  if (!serviceZoneId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "El fulfillment set de México no tiene service zone.",
    )
  }

  const existingOptions = await fulfillment.listShippingOptions({ service_zone_id: serviceZoneId })
  const options = [
    {
      name: "Envío estándar DEMO",
      code: "jovy-standard-demo",
      description: "Entrega de laboratorio. No representa una tarifa productiva.",
      amount: 99,
    },
    {
      name: "Envío express DEMO",
      code: "jovy-express-demo",
      description: "Entrega de laboratorio. No representa una tarifa productiva.",
      amount: 149,
    },
  ]

  for (const option of options) {
    if (existingOptions.some((existing) => existing.name === option.name)) continue
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: option.name,
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZoneId,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: option.name,
            description: option.description,
            code: option.code,
          },
          prices: [{ currency_code: CURRENCY, amount: option.amount }],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    logger.info(`[jovy-commerce] opción de envío creada: ${option.name}`)
  }

  logger.info(
    `[jovy-commerce] listo. Región ${region.name} (${region.currency_code}), envío manual y pago pp_system_default disponibles.`,
  )
}
