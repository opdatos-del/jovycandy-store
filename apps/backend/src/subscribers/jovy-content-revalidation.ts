import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  CONTENT_REVALIDATION_EVENT,
  CONTENT_REVALIDATION_TAG,
  buildContentRevalidationPayload,
  deliverContentRevalidation,
  readContentRevalidationConfig,
} from "@jovy/lib/jovy/content-revalidation"

type ContentChangedPayload = {
  tags?: string[]
  source?: string
}

/**
 * Entrega al storefront los cambios editoriales/comerciales ya confirmados.
 * Si no hay URL y secreto configurados, no hace nada: el desarrollo y CI no
 * dependen de que Next.js esté levantado.
 */
export default async function contentRevalidationHandler({
  event,
  container,
}: SubscriberArgs<ContentChangedPayload>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { config, errors } = readContentRevalidationConfig()

  if (errors.length) {
    logger.warn(
      `[content-revalidation] configuración incompleta: ${errors.join(" ")}`,
    )
    return
  }

  if (!config) return

  const requestedTags = Array.isArray(event.data?.tags)
    ? event.data.tags.filter((tag) => tag === CONTENT_REVALIDATION_TAG)
    : []
  const tags = requestedTags.length
    ? requestedTags
    : [CONTENT_REVALIDATION_TAG]

  const eventGroupId =
    typeof event.metadata?.eventGroupId === "string"
      ? event.metadata.eventGroupId
      : null
  const payload = buildContentRevalidationPayload(
    event.data?.source ?? "medusa",
    eventGroupId,
  )
  const result = await deliverContentRevalidation(config, {
    ...payload,
    tags,
  })

  if (result.ok) {
    logger.debug(
      `[content-revalidation] storefront revalidado en ${result.attempts} intento(s)`,
    )
    return
  }

  // Sin throw: un storefront caído no debe reintentar indefinidamente ni
  // bloquear la publicación. El TTL de la caché sigue siendo la red de safety.
  logger.warn(
    `[content-revalidation] no se pudo revalidar (${result.error ?? "sin detalle"}); el TTL del storefront se mantiene activo.`,
  )
}

export const config: SubscriberConfig = {
  event: CONTENT_REVALIDATION_EVENT,
}
