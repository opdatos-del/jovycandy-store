/**
 * Prepara la infraestructura comercial mínima de laboratorio:
 *
 *   pnpm --dir apps/backend seed:commerce
 *
 * - agrega MXN a la tienda si falta;
 * - crea/verifica la región México;
 * - crea la región fiscal de México;
 * - crea/verifica el stock location mexicano de laboratorio;
 * - reutiliza el shipping profile existente;
 * - crea una zona de fulfillment y opciones de envío de laboratorio para México;
 * - deja disponible `pp_system_default` (pago manual de Medusa).
 *
 * No crea pagos reales, no modifica pedidos y es idempotente.
 */
import {
  createLinksWorkflow,
  createRegionsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateRegionsWorkflow,
  updateShippingOptionsWorkflow,
  updateStockLocationsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createJovyLabFulfillmentSetWorkflow,
  markJovyLabFulfillmentSetWorkflow,
} from "@jovy/workflows/jovy-lab-commerce/fulfillment-set"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number }
  }) => Promise<{ data: unknown[] }>
}

type FulfillmentService = {
  listFulfillmentSets: (filters?: unknown, config?: unknown) => Promise<Array<{ id: string; name?: string; metadata?: Record<string, unknown> | null }>>
  listShippingOptions: (filters?: unknown, config?: unknown) => Promise<Array<{ id: string; name: string; type?: { code?: string } | null }>>
}

type TaxService = {
  listTaxRegions: (filters?: unknown) => Promise<Array<{ id: string; country_code?: string | null }>>
  createTaxRegions: (data: Record<string, unknown>) => Promise<unknown>
}

const REGION_NAME = "Mexico"
const CURRENCY = "mxn"
const COUNTRY = "MX"
const FULFILLMENT_SET_NAME = "Jovy México Laboratorio"
const STOCK_LOCATION_NAME = "Jovy México Laboratorio"
const LAB_LOCATION_METADATA_KEY = "jovy_lab_stock_location"
const LAB_FULFILLMENT_METADATA_KEY = "jovy_lab_fulfillment_set"

async function runCommerceSeed({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const fulfillment = container.resolve(Modules.FULFILLMENT) as unknown as FulfillmentService
  const tax = container.resolve(Modules.TAX) as unknown as TaxService

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "default_sales_channel_id", "supported_currencies.currency_code"],
  })
  const store = stores[0] as
    | { id: string; default_sales_channel_id?: string | null; supported_currencies?: Array<{ currency_code?: string | null }> }
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
    fields: [
      "id",
      "name",
      "currency_code",
      "countries.iso_2",
      "payment_providers.id",
    ],
  })
  let region = (regionRows as Array<{
    id: string
    name: string
    currency_code: string
    countries?: Array<{ iso_2?: string | null }> | null
    payment_providers?: Array<{ id?: string | null }> | null
  }>).find(
    (item) =>
      String(item.currency_code).toLowerCase() === CURRENCY ||
      (item.countries ?? []).some(
        (country) => String(country.iso_2 ?? "").toUpperCase() === COUNTRY,
      ),
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
    const hasCountry = (region.countries ?? []).some(
      (country) => String(country.iso_2 ?? "").toUpperCase() === COUNTRY,
    )
    const hasProvider = (region.payment_providers ?? []).some(
      (provider) => provider.id === "pp_system_default",
    )
    if (!hasCountry || !hasProvider) {
      await updateRegionsWorkflow(container).run({
        input: {
          selector: { id: region.id },
          update: {
            ...(String(region.currency_code).toLowerCase() !== CURRENCY
              ? { currency_code: CURRENCY }
              : {}),
            ...(!hasCountry ? { countries: [COUNTRY] } : {}),
            ...(!hasProvider
              ? { payment_providers: ["pp_system_default"] }
              : {}),
          },
        },
      })
      logger.info("[jovy-commerce] región México reparada")
    }
    logger.info(`[jovy-commerce] región ${region.name} reutilizada`)
  }

  const taxRegions = await tax.listTaxRegions({ country_code: COUNTRY })
  if (!taxRegions.length) {
    await tax.createTaxRegions({ country_code: COUNTRY, provider_id: "tp_system" })
    logger.info(`[jovy-commerce] región fiscal ${COUNTRY} creada`)
  }

  const stockLocationRows = (await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "metadata",
      "sales_channels.id",
      "fulfillment_providers.id",
      "fulfillment_sets.id",
    ],
    pagination: { take: 1000, skip: 0 },
  })).data as Array<{
    id: string
    name: string
    metadata?: Record<string, unknown> | null
    sales_channels?: Array<{ id?: string } | null> | null
    fulfillment_providers?: Array<{ id?: string } | null> | null
    fulfillment_sets?: Array<{ id?: string } | null> | null
  }>
  let stockLocation = stockLocationRows.find(
    (location) =>
      location.metadata?.[LAB_LOCATION_METADATA_KEY] === true ||
      location.name === STOCK_LOCATION_NAME,
  )

  if (stockLocation && stockLocation.metadata?.[LAB_LOCATION_METADATA_KEY] !== true) {
    await updateStockLocationsWorkflow(container).run({
      input: {
        selector: { id: stockLocation.id },
        update: {
          metadata: {
            ...(stockLocation.metadata ?? {}),
            [LAB_LOCATION_METADATA_KEY]: true,
            jovy_lab: true,
            country_code: COUNTRY,
          },
        },
      },
    })
  }

  if (!stockLocation) {
    const { result } = (await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: STOCK_LOCATION_NAME,
            metadata: {
              [LAB_LOCATION_METADATA_KEY]: true,
              jovy_lab: true,
              country_code: COUNTRY,
            },
          },
        ],
      },
    })) as unknown as { result: Array<{ id: string; name: string }> }
    stockLocation = result[0]
    logger.info(`[jovy-commerce] ubicación mexicana creada: ${stockLocation.name}`)
  }

  const salesChannels = (await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  })).data as Array<{ id: string }>
  const configuredChannelId = process.env.JOVY_SALES_CHANNEL_ID
  const salesChannelId = configuredChannelId
    ? salesChannels.find((channel) => channel.id === configuredChannelId)?.id
    : salesChannels.find((channel) => channel.id === store.default_sales_channel_id)?.id ??
      salesChannels[0]?.id
  if (!salesChannelId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No hay sales channel disponible.")
  }

  if (!(stockLocation.sales_channels ?? []).some((channel) => channel?.id === salesChannelId)) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannelId] },
    })
  }

  if (!(stockLocation.fulfillment_providers ?? []).some((provider) => provider?.id === "manual_manual")) {
    await createLinksWorkflow(container).run({
      input: [
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
        },
      ],
    })
  }

  const shippingProfileRows = (await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
    pagination: { take: 1000, skip: 0 },
  })).data as Array<{ id: string; name: string }>
  const configuredProfileId = process.env.JOVY_SHIPPING_PROFILE_ID
  let shippingProfile = configuredProfileId
    ? shippingProfileRows.find((profile) => profile.id === configuredProfileId)
    : shippingProfileRows.find((profile) => profile.name === "Default Shipping Profile") ??
      shippingProfileRows[0]
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: "Default Shipping Profile", type: "default" }],
      },
    })
    shippingProfile = result[0]
    logger.info("[jovy-commerce] shipping profile creado")
  }

  const fulfillmentSets = await fulfillment.listFulfillmentSets({}, { take: 1000 })
  let fulfillmentSet = fulfillmentSets.find(
    (set) =>
      set.metadata?.[LAB_FULFILLMENT_METADATA_KEY] === true ||
      set.name === FULFILLMENT_SET_NAME,
  )
  if (!fulfillmentSet) {
    const { result } = (await createJovyLabFulfillmentSetWorkflow(container).run({
      input: {
        name: FULFILLMENT_SET_NAME,
        type: "shipping",
        service_zones: [
          {
            name: "Mexico",
            // La dirección del carrito usa ISO-2 en minúsculas; la zona debe
            // coincidir exactamente para que Medusa resuelva opciones de envío.
            geo_zones: [{ country_code: COUNTRY.toLowerCase(), type: "country" }],
          },
        ],
      },
    })) as unknown as { result: Array<{ id: string; name: string }> }
    fulfillmentSet = result[0]
    logger.info("[jovy-commerce] fulfillment set México creado")
  }

  if (fulfillmentSet.metadata?.[LAB_FULFILLMENT_METADATA_KEY] !== true) {
    await markJovyLabFulfillmentSetWorkflow(container).run({
      input: {
        id: fulfillmentSet.id,
        metadata: {
          ...(fulfillmentSet.metadata ?? {}),
          [LAB_FULFILLMENT_METADATA_KEY]: true,
          country_code: COUNTRY,
        },
      },
    })
    fulfillmentSet.metadata = {
      ...(fulfillmentSet.metadata ?? {}),
      [LAB_FULFILLMENT_METADATA_KEY]: true,
      country_code: COUNTRY,
    }
  }

  if (
    !(stockLocation.fulfillment_sets ?? []).some(
      (set) => set?.id === fulfillmentSet.id,
    )
  ) {
    await createLinksWorkflow(container).run({
      input: [
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
          [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
        },
      ],
    })
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
  const legacyNames: Record<string, string> = {
    "Envío estándar DEMO": "Envío estándar",
    "Envío express DEMO": "Envío express",
  }

  for (const existing of existingOptions) {
    const nextName = legacyNames[existing.name]
    if (!nextName) continue
    await updateShippingOptionsWorkflow(container).run({
      input: [{ id: existing.id, name: nextName }],
    })
    existing.name = nextName
    logger.info(`[jovy-commerce] opción de envío renombrada: ${nextName}`)
  }

  const options = [
    {
      name: "Envío estándar",
      code: "jovy-standard-demo",
      description: "Entrega de laboratorio. No representa una tarifa productiva.",
      amount: 99,
    },
    {
      name: "Envío express",
      code: "jovy-express-demo",
      description: "Entrega de laboratorio. No representa una tarifa productiva.",
      amount: 149,
    },
  ]

  for (const option of options) {
    if (
      existingOptions.some(
        (existing) =>
          existing.type?.code === option.code || existing.name === option.name,
      )
    ) continue
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

export default async function seedCommerceLab({ container }: ExecArgs) {
  const locking = container.resolve(Modules.LOCKING) as {
    execute: <T>(
      key: string,
      job: () => Promise<T>,
      args?: { timeout?: number; expire?: number },
    ) => Promise<T>
  }
  await locking.execute(
    "jovy:seed:commerce-infrastructure",
    () => runCommerceSeed({ container } as ExecArgs),
    { timeout: 300, expire: 600 },
  )
}
