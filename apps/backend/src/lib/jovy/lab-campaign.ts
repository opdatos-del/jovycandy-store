import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

/**
 * Guardas y validaciones del seed de campañas de laboratorio.
 *
 * El seed escribe Price Lists y promociones activas, por lo que no puede
 * depender solo de `NODE_ENV` ni de una confirmación manual. La identidad de la
 * base se calcula desde `DATABASE_URL` y debe corresponder a un PostgreSQL
 * efímero verificable o a una huella explícitamente autorizada.
 */

export type LabCampaignErrorCode =
  | "forbidden_environment"
  | "missing_database_url"
  | "invalid_database_url"
  | "non_loopback_database"
  | "ephemeral_identity_mismatch"
  | "ephemeral_root_missing"
  | "database_not_authorized"
  | "invalid_date"
  | "invalid_range"
  | "invalid_number"
  | "invalid_code"
  | "duplicate_code"
  | "missing_skus"
  | "no_variants"

export class LabCampaignError extends Error {
  code: LabCampaignErrorCode

  constructor(code: LabCampaignErrorCode, message: string) {
    super(message)
    this.name = "LabCampaignError"
    this.code = code
  }
}

export type LabDatabaseIdentity = {
  host: string
  port: number
  database: string
  user: string
  fingerprint: string
}

export type LabCampaignConfig = {
  campaignIdentifier: string
  campaignName: string
  startsAt: Date
  endsAt: Date
  salePercent: number
  couponPercent: number
  automaticPercent: number
  variantLimit: number
  fixedAmount: number
  requestedSkus: string[]
  codes: {
    percent: string
    fixed: string
    automatic: string
    shipping: string
  }
}

export type CampaignVariant = {
  id: string
  sku?: string | null
  productId: string
  priceSetId: string
  baseAmount: number
}

export type CampaignProductRow = {
  id: string
  variants?: Array<{
    id?: string | null
    sku?: string | null
    price_set?: {
      id?: string | null
      prices?: Array<{
        amount?: number | null
        currency_code?: string | null
      }> | null
    } | null
  }> | null
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])
const FORBIDDEN_PORTS = new Set([5432, 55432])
const RUNS_DIRECTORY = path.join("JovyCandy", "integration-runs")
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,63}$/

function fail(code: LabCampaignErrorCode, message: string): never {
  throw new LabCampaignError(code, message)
}

function normalizePath(value: string) {
  return path.resolve(value).replace(/\\/g, "/").toLowerCase()
}

function asInt(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") return fallback
  if (!/^\d+$/.test(value.trim())) {
    fail("invalid_number", "El valor debe ser un entero positivo.")
  }
  return Number(value)
}

export function parseLabDatabaseIdentity(databaseUrl: string | undefined): LabDatabaseIdentity {
  if (!databaseUrl) {
    fail("missing_database_url", "DATABASE_URL es obligatorio para autorizar la campaña.")
  }

  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    fail("invalid_database_url", "DATABASE_URL no es una URL válida.")
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  const port = Number(url.port || "5432")
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""))
  const user = decodeURIComponent(url.username)

  if (!host || !database || !user || !Number.isInteger(port)) {
    fail("invalid_database_url", "DATABASE_URL no contiene host, base o usuario válidos.")
  }
  if (!LOOPBACK_HOSTS.has(host)) {
    fail(
      "non_loopback_database",
      "La campaña de laboratorio solo se permite contra PostgreSQL local.",
    )
  }

  const fingerprint = createHash("sha256")
    .update(`jovy-lab-campaign:v1|${host}|${port}|${database.toLowerCase()}|${user.toLowerCase()}`)
    .digest("hex")

  return { host, port, database, user, fingerprint }
}

function readEphemeralMarker(runId: string, localAppData: string) {
  const root = path.join(localAppData, RUNS_DIRECTORY, runId.toLowerCase())
  const markerPath = path.join(root, "run.json")
  if (!fs.existsSync(markerPath)) return null
  try {
    return JSON.parse(fs.readFileSync(markerPath, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Acepta únicamente un cluster efímero verificable o una base local autorizada
 * por huella. Producción y staging se rechazan antes de mirar cualquier otra
 * variable.
 */
export function assertLabCampaignDatabase(
  environment: NodeJS.ProcessEnv = process.env,
  identity: LabDatabaseIdentity = parseLabDatabaseIdentity(environment.DATABASE_URL),
): void {
  const deployment = String(environment.DEPLOYMENT_ENV ?? "").toLowerCase()
  if (
    String(environment.NODE_ENV ?? "").toLowerCase() === "production" ||
    deployment === "production" ||
    deployment === "staging"
  ) {
    fail(
      "forbidden_environment",
      "seed:campaign no puede ejecutarse en producción ni staging.",
    )
  }

  if (FORBIDDEN_PORTS.has(identity.port)) {
    const authorizedFingerprint = String(environment.JOVY_LAB_DATABASE_SHA256 ?? "").toLowerCase()
    const authorized = authorizedFingerprint === identity.fingerprint
    if (!authorized) {
      fail(
        "database_not_authorized",
        `El puerto ${identity.port} requiere autorización explícita por huella. Huella actual: ${identity.fingerprint}`,
      )
    }
  }

  if (environment.JOVY_EPHEMERAL_POSTGRES === "1") {
    const runId = String(environment.JOVY_EPHEMERAL_POSTGRES_RUN_ID ?? "").toLowerCase()
    const root = String(environment.JOVY_EPHEMERAL_POSTGRES_ROOT ?? "")
    const dataDirectory = String(environment.JOVY_EPHEMERAL_POSTGRES_DATA_DIRECTORY ?? "")
    const localAppData = String(environment.LOCALAPPDATA ?? "")
    const ephemeralPort = Number(environment.JOVY_EPHEMERAL_POSTGRES_PORT)

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId) ||
      !root ||
      !dataDirectory ||
      !localAppData ||
      ephemeralPort !== identity.port
    ) {
      fail(
        "ephemeral_identity_mismatch",
        "La identidad del PostgreSQL efímero no corresponde a DATABASE_URL.",
      )
    }

    const expectedRoot = path.join(localAppData, RUNS_DIRECTORY, runId)
    if (normalizePath(root) !== normalizePath(expectedRoot)) {
      fail("ephemeral_identity_mismatch", "El directorio del cluster efímero no es el esperado.")
    }
    if (normalizePath(dataDirectory) !== normalizePath(path.join(root, "data"))) {
      fail("ephemeral_identity_mismatch", "El directorio de datos efímero no es el esperado.")
    }
    if (!fs.existsSync(root)) {
      fail("ephemeral_root_missing", "El directorio del cluster efímero no existe.")
    }

    const marker = readEphemeralMarker(runId, localAppData)
    if (
      !marker ||
      String(marker.runId ?? "").toLowerCase() !== runId ||
      Number(marker.port) !== identity.port ||
      !marker.postgresPid
    ) {
      fail(
        "ephemeral_identity_mismatch",
        "El marcador del cluster efímero no corresponde a la ejecución actual.",
      )
    }
    return
  }

  const authorizedFingerprint = String(environment.JOVY_LAB_DATABASE_SHA256 ?? "").toLowerCase()
  const confirmation = String(environment.JOVY_LAB_DATABASE_CONFIRM ?? "").toLowerCase()
  if (authorizedFingerprint !== identity.fingerprint || confirmation !== "authorized") {
    fail(
      "database_not_authorized",
      `Base no autorizada. Huella actual: ${identity.fingerprint}. Define JOVY_LAB_DATABASE_SHA256 con esa huella y JOVY_LAB_DATABASE_CONFIRM=authorized solo si es una base de laboratorio.`,
    )
  }
}

function parseDate(value: string | undefined, name: string, fallback?: Date): Date {
  if (!value) {
    if (!fallback) fail("invalid_date", `${name} es obligatorio.`)
    return fallback
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    fail("invalid_date", `${name} no es una fecha válida.`)
  }
  return date
}

function readCode(value: string | undefined, fallback: string, name: string): string {
  const code = (value ?? fallback).trim().toUpperCase()
  if (!CODE_PATTERN.test(code)) {
    fail(
      "invalid_code",
      `${name} debe usar mayúsculas, números, guiones o guiones bajos (3-64 caracteres).`,
    )
  }
  return code
}

export function resolveLabCampaignConfig(
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
): LabCampaignConfig {
  const startsAt = parseDate(
    environment.JOVY_CAMPAIGN_START,
    "JOVY_CAMPAIGN_START",
    now,
  )
  const endsAt = parseDate(
    environment.JOVY_CAMPAIGN_END,
    "JOVY_CAMPAIGN_END",
    new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1_000),
  )

  if (endsAt.getTime() <= startsAt.getTime()) {
    fail("invalid_date", "JOVY_CAMPAIGN_END debe ser posterior a JOVY_CAMPAIGN_START.")
  }
  if (endsAt.getTime() <= now.getTime()) {
    fail("invalid_date", "La campaña de laboratorio debe terminar en el futuro.")
  }
  if (endsAt.getTime() - startsAt.getTime() > 366 * 24 * 60 * 60 * 1_000) {
    fail("invalid_range", "La vigencia no puede superar 366 días.")
  }

  const salePercent = asInt(environment.JOVY_CAMPAIGN_SALE_PERCENT, 20)
  if (salePercent < 1 || salePercent > 90) {
    fail("invalid_range", "JOVY_CAMPAIGN_SALE_PERCENT debe estar entre 1 y 90.")
  }

  const couponPercent = asInt(environment.JOVY_CAMPAIGN_COUPON_PERCENT, 10)
  if (couponPercent < 1 || couponPercent > 90) {
    fail("invalid_range", "JOVY_CAMPAIGN_COUPON_PERCENT debe estar entre 1 y 90.")
  }

  const automaticPercent = asInt(environment.JOVY_CAMPAIGN_AUTOMATIC_PERCENT, 15)
  if (automaticPercent < 1 || automaticPercent > 90) {
    fail("invalid_range", "JOVY_CAMPAIGN_AUTOMATIC_PERCENT debe estar entre 1 y 90.")
  }

  const variantLimit = asInt(environment.JOVY_CAMPAIGN_VARIANT_LIMIT, 5)
  if (variantLimit < 1 || variantLimit > 50) {
    fail("invalid_range", "JOVY_CAMPAIGN_VARIANT_LIMIT debe estar entre 1 y 50.")
  }

  const fixedAmount = asInt(environment.JOVY_CAMPAIGN_FIXED_AMOUNT, 50)
  if (fixedAmount < 1 || fixedAmount > 1_000_000) {
    fail("invalid_range", "JOVY_CAMPAIGN_FIXED_AMOUNT debe estar entre 1 y 1,000,000.")
  }

  const requestedSkus = [...new Set(
    String(environment.JOVY_CAMPAIGN_SKUS ?? "")
      .split(",")
      .map((sku) => sku.trim().toUpperCase())
      .filter(Boolean),
  )]
  if (
    String(environment.JOVY_CAMPAIGN_SKUS ?? "").trim() &&
    !requestedSkus.length
  ) {
    fail("missing_skus", "JOVY_CAMPAIGN_SKUS no contiene SKU válidos.")
  }

  const codes = {
    percent: readCode(environment.JOVY_CAMPAIGN_CODE_PERCENT, "BUENFIN10", "Código porcentual"),
    fixed: readCode(environment.JOVY_CAMPAIGN_CODE_FIXED, "BUENFIN50", "Código fijo"),
    automatic: readCode(environment.JOVY_CAMPAIGN_CODE_AUTO, "AUTO15", "Código automático"),
    shipping: readCode(environment.JOVY_CAMPAIGN_CODE_SHIPPING, "ENVIOGRATIS", "Código de envío"),
  }
  if (new Set(Object.values(codes)).size !== Object.values(codes).length) {
    fail("duplicate_code", "Los códigos de promoción deben ser distintos.")
  }

  return {
    campaignIdentifier: (environment.JOVY_CAMPAIGN_IDENTIFIER ?? "buen-fin-laboratorio").trim(),
    campaignName: (environment.JOVY_CAMPAIGN_NAME ?? "Buen Fin Laboratorio").trim(),
    startsAt,
    endsAt,
    salePercent,
    couponPercent,
    automaticPercent,
    variantLimit,
    fixedAmount,
    requestedSkus,
    codes,
  }
}

/**
 * Selección determinista: SKU ascendente y, como desempate, id de variante.
 * Si se piden SKU concretos, todos deben existir.
 */
export function selectCampaignVariants(
  products: CampaignProductRow[],
  requestedSkus: string[],
  limit: number,
  currencyCode = "mxn",
): CampaignVariant[] {
  const candidates: CampaignVariant[] = []

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (!variant.id || !variant.price_set?.id) continue
      const price = (variant.price_set.prices ?? []).find(
        (item) => String(item.currency_code).toLowerCase() === currencyCode,
      )
      if (typeof price?.amount !== "number" || price.amount <= 0) continue
      candidates.push({
        id: variant.id,
        sku: variant.sku ?? null,
        productId: product.id,
        priceSetId: variant.price_set.id,
        baseAmount: price.amount,
      })
    }
  }

  candidates.sort((left, right) => {
    const bySku = String(left.sku ?? "").localeCompare(String(right.sku ?? ""))
    return bySku !== 0 ? bySku : left.id.localeCompare(right.id)
  })

  if (requestedSkus.length) {
    const bySku = new Map(
      candidates
        .filter((variant) => variant.sku)
        .map((variant) => [String(variant.sku).toUpperCase(), variant]),
    )
    const missing = requestedSkus.filter((sku) => !bySku.has(sku))
    if (missing.length) {
      fail(
        "missing_skus",
        `No existen variantes publicadas con precio para los SKU: ${missing.join(", ")}.`,
      )
    }
    const selected = requestedSkus.map((sku) => bySku.get(sku) as CampaignVariant)
    if (selected.length > limit) {
      fail(
        "invalid_range",
        `Se solicitaron ${selected.length} SKU y el límite es ${limit}.`,
      )
    }
    return selected
  }

  if (!candidates.length) {
    fail(
      "no_variants",
      "No hay variantes publicadas con precio MXN para preparar la campaña.",
    )
  }

  return candidates.slice(0, limit)
}

export function campaignTargetRules(variantProductIds: string[]) {
  const values = [...new Set(variantProductIds)].sort()
  return [
    {
      attribute: "items.product.id",
      operator: "in",
      values,
    },
  ]
}
