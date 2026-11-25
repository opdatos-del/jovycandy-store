import { createHmac } from "node:crypto"

/**
 * Evento interno de Medusa. El observer de mutaciones Admin lo emite después de
 * una respuesta correcta; un subscriber lo entrega al storefront con HMAC.
 */
export const CONTENT_REVALIDATION_EVENT = "jovy-content.changed"

/** Única etiqueta de caché que el storefront acepta invalidar. */
export const CONTENT_REVALIDATION_TAG = "jovy-content"

const CONTENT_PREFIXES = [
  "/admin/jovy/marketing/",
  "/admin/jovy/catalogue/",
  "/admin/jovy/content/",
  "/admin/jovy/events/",
  "/admin/jovy/brand/",
  "/admin/jovy/launches/",
  "/admin/jovy/products/",
  "/admin/jovy/product-card-visual/",
  "/admin/jovy/announcements/",
  "/admin/products",
  "/admin/product-categories",
  "/admin/product-tags",
  "/admin/uploads",
  "/admin/price-lists",
  "/admin/sales-channels",
  "/admin/collections",
] as const

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

export type ContentRevalidationConfig = {
  url: string
  secret: string
  timeoutMs: number
}

export type ContentRevalidationPayload = {
  eventId: string | null
  source: string
  tags: string[]
  occurredAt: string
}

export type ContentRevalidationResult = {
  ok: boolean
  status?: number
  error?: string
  attempts: number
}

type DeliveryDependencies = {
  fetchImpl?: typeof fetch
  retryDelaysMs?: number[]
}

/**
 * Un cambio editorial o comercial solo justifica revalidación si la petición
 * admin mutó contenido que el storefront cachea. Las lecturas y las respuestas
 * fallidas se ignoran.
 */
export function isContentRevalidationRequest(
  method: string,
  path: string,
): boolean {
  if (!MUTATION_METHODS.has(method.toUpperCase())) return false

  const pathname = path.split("?")[0]
  return CONTENT_PREFIXES.some(
    (prefix) =>
      pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
  )
}

function isWeakSecret(value: string): boolean {
  return (
    /(replace|generate|change[-_ ]?me|supersecret|placeholder|example|ci-)/i.test(
      value,
    ) ||
    /^(.)\1+$/.test(value) ||
    /^0+$/.test(value)
  )
}

function isLoopback(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("127.")
  )
}

/**
 * Lee la configuración de entrega sin exponer secretos. Sin URL y secreto el
 * storefront simplemente conserva su TTL; una configuración parcial es un
 * error de operación.
 */
export function readContentRevalidationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): { config: ContentRevalidationConfig | null; errors: string[] } {
  const rawUrl = environment.STOREFRONT_REVALIDATION_URL?.trim()
  const rawSecret = environment.STOREFRONT_REVALIDATION_SECRET?.trim()

  if (!rawUrl && !rawSecret) {
    return { config: null, errors: [] }
  }

  const errors: string[] = []
  if (!rawUrl) {
    errors.push(
      "STOREFRONT_REVALIDATION_URL es obligatorio cuando se define el secreto.",
    )
  }
  if (!rawSecret) {
    errors.push(
      "STOREFRONT_REVALIDATION_SECRET es obligatorio cuando se define la URL.",
    )
  }
  if (errors.length) return { config: null, errors }

  let url: URL
  try {
    url = new URL(rawUrl as string)
  } catch {
    return {
      config: null,
      errors: ["STOREFRONT_REVALIDATION_URL debe ser una URL válida."],
    }
  }

  const deployed = ["staging", "production"].includes(
    (environment.DEPLOYMENT_ENV ?? "").trim().toLowerCase(),
  )
  const internalStagingHttp =
    deployed &&
    environment.DEPLOYMENT_ENV?.trim().toLowerCase() === "staging" &&
    url.protocol === "http:" &&
    url.hostname === "storefront" &&
    (url.port === "" || url.port === "3000") &&
    url.pathname === "/api/revalidate"

  if (!["http:", "https:"].includes(url.protocol)) {
    errors.push(
      "STOREFRONT_REVALIDATION_URL debe usar http o https.",
    )
  } else if (
    url.protocol === "http:" &&
    !internalStagingHttp &&
    (deployed || !isLoopback(url.hostname))
  ) {
    errors.push(
      "STOREFRONT_REVALIDATION_URL debe usar HTTPS fuera de desarrollo local.",
    )
  }

  if ((rawSecret as string).length < 32 || isWeakSecret(rawSecret as string)) {
    errors.push(
      "STOREFRONT_REVALIDATION_SECRET debe ser real y tener al menos 32 caracteres.",
    )
  }

  const timeout = Number(environment.STOREFRONT_REVALIDATION_TIMEOUT_MS ?? 3000)
  if (!Number.isFinite(timeout) || timeout < 250 || timeout > 30_000) {
    errors.push(
      "STOREFRONT_REVALIDATION_TIMEOUT_MS debe estar entre 250 y 30000.",
    )
  }

  if (errors.length) return { config: null, errors }

  return {
    config: {
      url: url.toString(),
      secret: rawSecret as string,
      timeoutMs: timeout,
    },
    errors: [],
  }
}

/** Firma `timestamp.cuerpo` para el endpoint del storefront. */
export function signContentRevalidation(
  secret: string,
  timestamp: string,
  body: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")
}

export function buildContentRevalidationPayload(
  source: string,
  eventId: string | null = null,
  now: Date = new Date(),
): ContentRevalidationPayload {
  return {
    eventId,
    source,
    tags: [CONTENT_REVALIDATION_TAG],
    occurredAt: now.toISOString(),
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/**
 * Entrega best-effort con reintentos cortos. Un fallo no bloquea la mutación
 * editorial: el contenido sigue publicándose y el TTL del storefront actúa como
 * recuperación. Los errores se devuelven para que el subscriber los registre.
 */
export async function deliverContentRevalidation(
  config: ContentRevalidationConfig,
  payload: ContentRevalidationPayload,
  { fetchImpl = fetch, retryDelaysMs = [250, 1000] }: DeliveryDependencies = {},
): Promise<ContentRevalidationResult> {
  const body = JSON.stringify(payload)
  const timestamp = String(Date.now())
  const headers = {
    "content-type": "application/json",
    "x-jovy-timestamp": timestamp,
    "x-jovy-signature": signContentRevalidation(
      config.secret,
      timestamp,
      body,
    ),
    ...(payload.eventId ? { "x-jovy-event-id": payload.eventId } : {}),
  }

  let lastError = "sin respuesta"
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await fetchImpl(config.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(config.timeoutMs),
      })

      if (response.ok) {
        return { ok: true, status: response.status, attempts: attempt + 1 }
      }

      lastError = `HTTP ${response.status}`
      // Un 4xx no se recupera reintentando la misma firma.
      if (response.status < 500) {
        return {
          ok: false,
          status: response.status,
          error: lastError,
          attempts: attempt + 1,
        }
      }
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : "error de red"
    }

    if (attempt < retryDelaysMs.length) {
      await sleep(retryDelaysMs[attempt])
    }
  }

  return { ok: false, error: lastError, attempts: retryDelaysMs.length + 1 }
}
