/**
 * Preparación exclusiva del E2E aislado de campañas.
 *
 * - infraestructura comercial de laboratorio;
 * - catálogo Jovy de laboratorio;
 * - usuario administrador con rol superadmin;
 * - publishable key ligada al canal.
 *
 * No crea la campaña: el E2E la configura por la API Admin, igual que un
 * administrador real. La base es efímera y la destruye el runner.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ApiKeyType,
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { JOVY_SEED_PRODUCTS } from "@jovy/lib/jovy/catalog-seed"
import { JOVY_AUTHZ_MODULE } from "@jovy/modules/jovy-authz"
import seedJovyCatalog from "@jovy/scripts/seed-jovy-catalog"
import seedCommerceLab from "@jovy/scripts/seed-commerce-lab"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number }
  }) => Promise<{ data: unknown[] }>
}

export default async function seedCampaignE2E({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph

  await seedCommerceLab({ container, args: [] } as ExecArgs)
  await seedJovyCatalog({ container, args: [] } as ExecArgs)

  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const channel = channels[0] as { id: string; name?: string } | undefined
  if (!channel) throw new Error("No hay sales channel para el E2E.")

  const handle = JOVY_SEED_PRODUCTS[0]?.handle
  if (!handle) throw new Error("El catálogo de laboratorio no tiene producto inicial.")

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "variants.id",
      "variants.sku",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.currency_code",
    ],
    filters: { handle },
    pagination: { take: 1, skip: 0 },
  })
  const product = products[0] as
    | {
        id: string
        handle: string
        title?: string | null
        variants?: Array<{
          id: string
          sku?: string | null
          price_set?: {
            prices?: Array<{ amount?: number | null; currency_code?: string | null }> | null
          } | null
        }> | null
      }
    | undefined
  const variant = product?.variants?.[0]
  const baseAmount = variant?.price_set?.prices?.find(
    (price) => String(price.currency_code).toLowerCase() === "mxn",
  )?.amount
  if (!product || !variant || typeof baseAmount !== "number") {
    throw new Error("No se pudo resolver el producto de laboratorio del E2E.")
  }

  const apiKeyModule = container.resolve(Modules.API_KEY)
  const key = await apiKeyModule.createApiKeys({
    title: "Jovy E2E campaign",
    type: ApiKeyType.PUBLISHABLE,
    created_by: "e2e-campaign",
  })
  const link = container.resolve(ContainerRegistrationKeys.LINK) as {
    create: (payload: Record<string, unknown>) => Promise<unknown>
  }
  await link.create({
    [Modules.API_KEY]: { publishable_key_id: key.id },
    [Modules.SALES_CHANNEL]: { sales_channel_id: channel.id },
  })

  const email = process.env.JOVY_E2E_ADMIN_EMAIL ?? "e2e.campaign@jovy.test"
  const password = process.env.JOVY_E2E_ADMIN_PASSWORD ?? "E2E-Campaign-1234"
  const auth = container.resolve(Modules.AUTH)
  const users = container.resolve(Modules.USER)

  const registration = await auth.register("emailpass", {
    body: { email, password },
    protocol: "https",
  })
  if (!registration.authIdentity) {
    throw new Error("No se pudo crear la identidad del administrador E2E.")
  }
  const user = await users.createUsers({
    email,
    first_name: "E2E",
    last_name: "Campaign",
  })
  await auth.updateAuthIdentities({
    id: registration.authIdentity.id,
    app_metadata: { user_id: user.id },
  })

  const authz = container.resolve(JOVY_AUTHZ_MODULE) as {
    ensureSystemRoles: () => Promise<void>
    assignBootstrapSuperadmin: (input: {
      userId: string
      mode: "bootstrap"
    }) => Promise<unknown>
  }
  await authz.ensureSystemRoles()
  await authz.assignBootstrapSuperadmin({ userId: user.id, mode: "bootstrap" })

  const marker = {
    email,
    password,
    publishableKey: key.token,
    salesChannelId: channel.id,
    product: {
      id: product.id,
      handle: product.handle,
      title: product.title ?? "",
      variantId: variant.id,
      sku: variant.sku ?? null,
      baseAmount,
    },
  }
  process.stdout.write(`\nJOVY_E2E_SEED ${JSON.stringify(marker)}\n`)
}
