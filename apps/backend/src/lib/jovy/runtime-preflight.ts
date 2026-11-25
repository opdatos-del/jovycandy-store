import { MedusaError } from "@medusajs/framework/utils"

import type { RuntimeConfiguration } from "./runtime-configuration"

export type PreflightLevel = "error" | "warning"

export type PreflightIssue = {
  level: PreflightLevel
  variable: string
  message: string
}

const PLACEHOLDER_PATTERN =
  /(replace|generate|change[-_ ]?me|supersecret|placeholder|example|ci-)/i

const CORS_VARIABLES = ["STORE_CORS", "ADMIN_CORS", "AUTH_CORS"] as const

function issue(
  level: PreflightLevel,
  variable: string,
  message: string,
): PreflightIssue {
  return { level, variable, message }
}

function parseUrl(variable: string, raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

function isPlaceholder(value: string): boolean {
  return (
    PLACEHOLDER_PATTERN.test(value) ||
    /^(.)\1+$/.test(value) ||
    /^0+$/.test(value)
  )
}

function isLoopback(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase()

  return (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.startsWith("127.")
  )
}

function validateDatabase(
  environment: NodeJS.ProcessEnv,
  deployed: boolean,
): PreflightIssue[] {
  const raw = environment.DATABASE_URL?.trim()

  if (!raw) {
    return [issue("error", "DATABASE_URL", "DATABASE_URL es obligatorio.")]
  }

  const url = parseUrl("DATABASE_URL", raw)
  if (!url || !["postgres:", "postgresql:"].includes(url.protocol)) {
    return [
      issue(
        "error",
        "DATABASE_URL",
        "DATABASE_URL debe ser una URL PostgreSQL válida.",
      ),
    ]
  }

  if (isPlaceholder(raw)) {
    return [
      issue(
        "error",
        "DATABASE_URL",
        "DATABASE_URL conserva un placeholder; carga la credencial real desde el gestor de secretos.",
      ),
    ]
  }

  if (deployed && isLoopback(url.hostname)) {
    return [
      issue(
        "error",
        "DATABASE_URL",
        "DATABASE_URL no puede apuntar a loopback en staging ni producción.",
      ),
    ]
  }

  if (
    deployed &&
    url.password &&
    (url.password.length < 12 || isPlaceholder(decodeURIComponent(url.password)))
  ) {
    return [
      issue(
        "error",
        "DATABASE_URL",
        "La contraseña de DATABASE_URL debe ser real y tener al menos 12 caracteres.",
      ),
    ]
  }

  return []
}

function validateSecrets(
  environment: NodeJS.ProcessEnv,
  deployed: boolean,
): PreflightIssue[] {
  const issues: PreflightIssue[] = []
  const secrets = ["JWT_SECRET", "COOKIE_SECRET"] as const

  for (const variable of secrets) {
    const value = environment[variable]?.trim()

    if (!value) {
      issues.push(issue("error", variable, `${variable} es obligatorio.`))
      continue
    }

    if (deployed && isPlaceholder(value)) {
      issues.push(
        issue(
          "error",
          variable,
          `${variable} conserva un placeholder; usa un secreto real del gestor de secretos.`,
        ),
      )
      continue
    }

    if (deployed && value.length < 32) {
      issues.push(
        issue(
          "error",
          variable,
          `${variable} debe tener al menos 32 caracteres en staging y producción.`,
        ),
      )
    }
  }

  const jwt = environment.JWT_SECRET?.trim()
  const cookie = environment.COOKIE_SECRET?.trim()
  if (deployed && jwt && cookie && jwt === cookie) {
    issues.push(
      issue(
        "error",
        "JWT_SECRET",
        "JWT_SECRET y COOKIE_SECRET deben ser secretos distintos.",
      ),
    )
  }

  const mfaKey = environment.AUTH_MFA_ENCRYPTION_KEY?.trim()
  if (
    deployed &&
    mfaKey &&
    (!/^[a-f0-9]{64}$/i.test(mfaKey) || isPlaceholder(mfaKey))
  ) {
    issues.push(
      issue(
        "error",
        "AUTH_MFA_ENCRYPTION_KEY",
        "AUTH_MFA_ENCRYPTION_KEY debe tener 64 caracteres hexadecimales y no ser un placeholder.",
      ),
    )
  }

  const commerceSecret = environment.JOVY_COMMERCE_SECRET?.trim()
  const revalidationSecret = environment.JOVY_REVALIDATION_SECRET?.trim()
  if (deployed && (commerceSecret || revalidationSecret)) {
    for (const [variable, value] of [
      ["JOVY_COMMERCE_SECRET", commerceSecret],
      ["JOVY_REVALIDATION_SECRET", revalidationSecret],
    ] as const) {
      if (!value || value.length < 32 || isPlaceholder(value)) {
        issues.push(
          issue(
            "error",
            variable,
            `${variable} debe ser real y tener al menos 32 caracteres.`,
          ),
        )
      }
    }
  }

  return issues
}

function validateCorsOrigin(
  variable: string,
  rawOrigin: string,
  deployed: boolean,
): PreflightIssue[] {
  if (rawOrigin === "*") {
    return [
      issue(
        "error",
        variable,
        `${variable} no admite comodín; declara orígenes exactos.`,
      ),
    ]
  }

  const url = parseUrl(variable, rawOrigin)
  if (!url || !["http:", "https:"].includes(url.protocol)) {
    return [
      issue(
        "error",
        variable,
        `${variable} contiene un origen inválido; usa http(s)://host[:puerto].`,
      ),
    ]
  }

  if (rawOrigin !== url.origin) {
    return [
      issue(
        "error",
        variable,
        `${variable} debe contener orígenes exactos, sin path ni slash final.`,
      ),
    ]
  }

  if (!deployed) return []

  const issues: PreflightIssue[] = []
  if (url.protocol !== "https:") {
    issues.push(
      issue(
        "error",
        variable,
        `${variable} debe usar HTTPS en staging y producción.`,
      ),
    )
  }

  if (isLoopback(url.hostname)) {
    issues.push(
      issue(
        "error",
        variable,
        `${variable} no puede apuntar a loopback en staging ni producción.`,
      ),
    )
  }

  return issues
}

function validateCors(
  environment: NodeJS.ProcessEnv,
  deployed: boolean,
): PreflightIssue[] {
  const issues: PreflightIssue[] = []

  for (const variable of CORS_VARIABLES) {
    const raw = environment[variable]?.trim()

    if (!raw) {
      issues.push(
        issue(
          deployed ? "error" : "warning",
          variable,
          `${variable} no está definido.`,
        ),
      )
      continue
    }

    for (const origin of raw.split(",").map((value) => value.trim())) {
      if (!origin) {
        issues.push(
          issue(
            "error",
            variable,
            `${variable} contiene un origen vacío.`,
          ),
        )
        continue
      }

      issues.push(...validateCorsOrigin(variable, origin, deployed))
    }
  }

  return issues
}

function validateRedis(
  configuration: RuntimeConfiguration,
  environment: NodeJS.ProcessEnv,
  deployed: boolean,
): PreflightIssue[] {
  const issues: PreflightIssue[] = []
  const separateProcesses = configuration.workerMode !== "shared"

  if (separateProcesses && !configuration.redis.enabled) {
    issues.push(
      issue(
        deployed ? "error" : "warning",
        "MEDUSA_REDIS_ENABLED",
        "server y worker separados requieren Redis para eventos, workflows y locking compartidos.",
      ),
    )
  }

  if (configuration.redis.enabled) {
    const redisPassword = environment.REDIS_PASSWORD?.trim()
    if (
      deployed &&
      (!redisPassword ||
        redisPassword.length < 24 ||
        isPlaceholder(redisPassword))
    ) {
      issues.push(
        issue(
          "error",
          "REDIS_PASSWORD",
          "REDIS_PASSWORD debe ser real y tener al menos 24 caracteres.",
        ),
      )
    }

    const urls = [
      configuration.redis.eventsUrl,
      configuration.redis.workflowUrl,
      configuration.redis.cacheUrl,
      configuration.redis.lockingUrl,
    ]

    if (new Set(urls).size !== urls.length) {
      issues.push(
        issue(
          "warning",
          "MEDUSA_REDIS_ENABLED",
          "Las URLs Redis no están segregadas; usa bases o instancias distintas por responsabilidad.",
        ),
      )
    }
  }

  if (deployed && !configuration.sessionRedisUrl && !separateProcesses) {
    issues.push(
      issue(
        "warning",
        "SESSION_REDIS_URL",
        "Las sesiones quedan en memoria; no es apto para varias instancias del servidor.",
      ),
    )
  }

  if (environment.SESSION_REDIS_URL && !configuration.sessionRedisUrl) {
    issues.push(
      issue(
        "error",
        "SESSION_REDIS_URL",
        "SESSION_REDIS_URL no es una URL Redis válida.",
      ),
    )
  }

  return issues
}

function validateFileStorage(
  configuration: RuntimeConfiguration,
  environment: NodeJS.ProcessEnv,
  deployed: boolean,
): PreflightIssue[] {
  if (!deployed) return []

  if (configuration.file.provider === "local") {
    if (
      configuration.deploymentEnvironment === "staging" &&
      configuration.allowLocalStorageInStaging
    ) {
      return [
        issue(
          "warning",
          "FILE_STORAGE_PROVIDER",
          "staging usa file-local por excepción explícita; el volumen debe ser persistente y respaldado.",
        ),
      ]
    }

    return [
      issue(
        "error",
        "FILE_STORAGE_PROVIDER",
        "staging y producción requieren almacenamiento persistente; configura s3.",
      ),
    ]
  }

  const issues: PreflightIssue[] = []
  const fileUrl = parseUrl("S3_FILE_URL", configuration.file.fileUrl)

  if (!fileUrl || fileUrl.protocol !== "https:") {
    issues.push(
      issue(
        "error",
        "S3_FILE_URL",
        "S3_FILE_URL debe ser una URL HTTPS en staging y producción.",
      ),
    )
  } else if (fileUrl.search || fileUrl.hash) {
    issues.push(
      issue(
        "error",
        "S3_FILE_URL",
        "S3_FILE_URL no debe incluir query ni fragmento.",
      ),
    )
  }

  if (
    isPlaceholder(configuration.file.accessKeyId) ||
    isPlaceholder(configuration.file.secretAccessKey)
  ) {
    issues.push(
      issue(
        "error",
        "S3_ACCESS_KEY_ID",
        "Las credenciales S3 conservan un placeholder.",
      ),
    )
  }

  if (configuration.file.endpoint) {
    const endpoint = parseUrl("S3_ENDPOINT", configuration.file.endpoint)
    if (!endpoint || endpoint.protocol !== "https:") {
      issues.push(
        issue(
          "error",
          "S3_ENDPOINT",
          "S3_ENDPOINT debe usar HTTPS en staging y producción.",
        ),
      )
    }
  }

  return issues
}

/**
 * Revisa la configuración resuelta antes de arrancar. Devuelve errores y
 * advertencias sin exponer valores secretos. Solo debe invocarse cuando el
 * perfil de despliegue es explícito (`DEPLOYMENT_ENV`); así el build local y la
 * generación de tipos no exigen infraestructura de staging.
 */
export function collectRuntimePreflightIssues(
  configuration: RuntimeConfiguration,
  environment: NodeJS.ProcessEnv = process.env,
): PreflightIssue[] {
  const deployed = configuration.deploymentEnvironment !== "development"
  const issues: PreflightIssue[] = []

  if (
    deployed &&
    configuration.deploymentEnvironment !== "development" &&
    environment.NODE_ENV !== "production"
  ) {
    issues.push(
      issue(
        "error",
        "NODE_ENV",
        "staging y producción deben ejecutarse con NODE_ENV=production para cookies seguras.",
      ),
    )
  }

  if (
    environment.DEPLOYMENT_ENV === "development" &&
    environment.NODE_ENV === "production"
  ) {
    issues.push(
      issue(
        "error",
        "DEPLOYMENT_ENV",
        "DEPLOYMENT_ENV=development no es compatible con NODE_ENV=production.",
      ),
    )
  }

  issues.push(...validateDatabase(environment, deployed))
  issues.push(...validateSecrets(environment, deployed))
  issues.push(...validateCors(environment, deployed))
  issues.push(...validateRedis(configuration, environment, deployed))
  issues.push(...validateFileStorage(configuration, environment, deployed))

  if (
    deployed &&
    configuration.deploymentEnvironment === "production" &&
    !configuration.sessionRedisUrl
  ) {
    issues.push(
      issue(
        "warning",
        "SESSION_REDIS_URL",
        "producción sin Redis de sesiones solo es válida con una única instancia.",
      ),
    )
  }

  return issues
}

/** Formatea el informe sin incluir valores de variables sensibles. */
export function formatRuntimePreflightIssues(
  issues: PreflightIssue[],
): string {
  return issues
    .map(
      (entry) =>
        `[${entry.level}] ${entry.variable}: ${entry.message}`,
    )
    .join("\n")
}

/** Falla el arranque ante cualquier error; las advertencias solo se informan. */
export function assertRuntimePreflight(
  configuration: RuntimeConfiguration,
  environment: NodeJS.ProcessEnv = process.env,
): PreflightIssue[] {
  const issues = collectRuntimePreflightIssues(configuration, environment)
  const errors = issues.filter((entry) => entry.level === "error")

  if (errors.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Preflight de runtime falló:\n${formatRuntimePreflightIssues(errors)}`,
    )
  }

  return issues
}
