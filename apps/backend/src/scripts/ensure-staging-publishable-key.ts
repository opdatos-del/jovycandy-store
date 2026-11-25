import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type { ExecArgs } from "@medusajs/framework/types"
import {
  ApiKeyType,
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data: Array<Record<string, any>> }>
}

type ApiKeyRow = {
  id: string
  token: string
  title: string
  type: string
  revoked_at?: string | Date | null
  sales_channels?: Array<{ id?: string } | null> | null
}

type ApiKeyService = {
  createApiKeys: (data: {
    title: string
    type: ApiKeyType.PUBLISHABLE
    created_by: string
  }) => Promise<{ id: string; token: string; redacted: string }>
  revoke: (
    id: string,
    data: { revoked_by: string },
  ) => Promise<unknown>
  deleteApiKeys: (ids: string[]) => Promise<void>
}

type LinkService = {
  create: (payload: Record<string, Record<string, string>>) => Promise<unknown>
  dismiss: (payload: Record<string, Record<string, string>>) => Promise<unknown>
}

const DEFAULT_KEY_TITLE = "Default Publishable API Key"

function isActive(key: ApiKeyRow): boolean {
  if (!key.revoked_at) return true
  return new Date(key.revoked_at).getTime() > Date.now()
}

function isLinkedToChannel(key: ApiKeyRow, salesChannelId: string): boolean {
  return (key.sales_channels ?? []).some(
    (channel) => channel?.id === salesChannelId,
  )
}

async function persistToken(tokenFile: string, token: string) {
  await mkdir(path.dirname(tokenFile), { recursive: true })
  const temporaryFile = `${tokenFile}.tmp`
  await writeFile(temporaryFile, `${token}\n`, { mode: 0o600 })
  await rename(temporaryFile, tokenFile)
}

/**
 * Crea una publishable API key para el storefront de staging y guarda el token
 * crudo en un volumen restringido. Las publishable keys se almacenan en claro en
 * Medusa 2.22.6, pero `authenticate()` solo valida secret keys; por eso la
 * validación se hace con Query Graph, tipo, revocación y vínculo al canal.
 */
export default async function ensureStagingPublishableKey({
  container,
}: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const apiKeys = container.resolve(Modules.API_KEY) as ApiKeyService
  const link = container.resolve(ContainerRegistrationKeys.LINK) as LinkService
  const tokenFile =
    process.env.STAGING_PUBLISHABLE_KEY_FILE ??
    "/app/data/staging-publishable-key.txt"

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "default_sales_channel_id"],
  })
  const salesChannelId = stores[0]?.default_sales_channel_id as
    | string
    | undefined
  if (!salesChannelId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No hay sales channel por defecto para la publishable key de staging.",
    )
  }

  const { data: keyRows } = await query.graph({
    entity: "api_key",
    fields: [
      "id",
      "token",
      "title",
      "type",
      "revoked_at",
      "sales_channels.id",
    ],
    filters: { type: "publishable" },
  })
  const publishableKeys = keyRows as unknown as ApiKeyRow[]

  const validateToken = (token: string): ApiKeyRow => {
    const key = publishableKeys.find(
      (candidate) =>
        candidate.token === token &&
        candidate.type === "publishable" &&
        isActive(candidate) &&
        isLinkedToChannel(candidate, salesChannelId),
    )
    if (!key) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "La publishable key configurada no existe, está revocada o no pertenece al canal.",
      )
    }
    return key
  }

  let storedToken: string | null = null
  try {
    storedToken = (await readFile(tokenFile, "utf8")).trim() || null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }

  if (storedToken) {
    validateToken(storedToken)
    logger.info("[staging] publishable key almacenada y válida")
    return
  }

  const configuredToken =
    process.env.STAGING_CONFIGURED_PUBLISHABLE_KEY?.trim() || null
  if (configuredToken) {
    validateToken(configuredToken)
    await persistToken(tokenFile, configuredToken)
    logger.info("[staging] publishable key configurada restaurada en el volumen")
    return
  }

  const linkedKeys = publishableKeys.filter((key) =>
    isLinkedToChannel(key, salesChannelId),
  )
  const linkedIds = new Set(linkedKeys.map((key) => key.id))
  const defaultKeys = linkedKeys.filter(
    (key) => key.title === DEFAULT_KEY_TITLE,
  )

  if (defaultKeys.length) {
    if (process.env.STAGING_ROTATE_DEFAULT_PUBLISHABLE_KEY !== "true") {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "La key inicial no tiene token recuperable. Habilita la rotación explícita de staging.",
      )
    }

    for (const key of defaultKeys) {
      await link.dismiss({
        [Modules.API_KEY]: { publishable_key_id: key.id },
        [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannelId },
      })
      await apiKeys.revoke(key.id, { revoked_by: "staging-bootstrap" })
      await apiKeys.deleteApiKeys([key.id])
    }
    logger.warn(
      `[staging] rotadas ${defaultKeys.length} publishable key inicial(es)`,
    )
  } else if (linkedIds.size) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      "Hay publishable keys ajenas al bootstrap sin token recuperable; no se rotan.",
    )
  }

  const key = await apiKeys.createApiKeys({
    title: "JovyCandy staging storefront",
    type: ApiKeyType.PUBLISHABLE,
    created_by: "staging-bootstrap",
  })
  await link.create({
    [Modules.API_KEY]: { publishable_key_id: key.id },
    [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannelId },
  })
  await persistToken(tokenFile, key.token)
  logger.info(`[staging] publishable key creada: ${key.redacted}`)
}
