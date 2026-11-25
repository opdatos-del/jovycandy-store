import { MedusaError } from "@medusajs/framework/utils"

export type WorkerMode = "server" | "worker" | "shared"
export type DeploymentEnvironment = "development" | "staging" | "production"

export type RedisConfiguration =
  | { enabled: false }
  | {
      enabled: true
      eventsUrl: string
      workflowUrl: string
      cacheUrl: string
      lockingUrl: string
    }

export type FileConfiguration =
  | { provider: "local" }
  | {
      provider: "s3"
      fileUrl: string
      accessKeyId: string
      secretAccessKey: string
      region: string
      bucket: string
      endpoint?: string
    }

export type RuntimeConfiguration = {
  workerMode: WorkerMode
  deploymentEnvironment: DeploymentEnvironment
  secureSessionCookie: boolean
  /** Excepción explícita solo para staging sin S3; nunca se acepta en producción. */
  allowLocalStorageInStaging: boolean
  /** Redis de sesión de `express-session`; independiente del caching de Medusa. */
  sessionRedisUrl?: string
  redis: RedisConfiguration
  file: FileConfiguration
}

const WORKER_MODES = new Set<WorkerMode>(["server", "worker", "shared"])
const DEPLOYMENT_ENVIRONMENTS = new Set<DeploymentEnvironment>([
  "development",
  "staging",
  "production",
])

function required(environment: NodeJS.ProcessEnv, variable: string): string {
  const value = environment[variable]?.trim()

  if (!value) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${variable} es obligatorio para esta configuración.`,
    )
  }

  return value
}

function requiredUrl(
  environment: NodeJS.ProcessEnv,
  variable: string,
  protocols: readonly string[],
): string {
  const value = required(environment, variable)

  try {
    const { protocol } = new URL(value)
    if (!protocols.includes(protocol)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `${variable} debe usar uno de estos protocolos: ${protocols.join(", ")}.`,
      )
    }
  } catch (error) {
    if (error instanceof MedusaError) throw error

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${variable} debe ser una URL válida.`,
    )
  }

  return value
}

function booleanFlag(
  environment: NodeJS.ProcessEnv,
  variable: string,
): boolean {
  const value = environment[variable]?.trim().toLowerCase()

  if (!value) return false
  if (value === "true") return true
  if (value === "false") return false

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `${variable} debe ser true o false.`,
  )
}

/** Perfil de despliegue explícito; `NODE_ENV` solo se usa como respaldo. */
export function resolveDeploymentEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): DeploymentEnvironment {
  const explicit = environment.DEPLOYMENT_ENV?.trim().toLowerCase()

  if (explicit) {
    if (!DEPLOYMENT_ENVIRONMENTS.has(explicit as DeploymentEnvironment)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "DEPLOYMENT_ENV debe ser development, staging o production.",
      )
    }

    return explicit as DeploymentEnvironment
  }

  return environment.NODE_ENV === "production" ? "production" : "development"
}

/**
 * Resuelve perfiles explícitos de infraestructura sin registrar proveedores
 * externos durante desarrollo local. Esta función no valida conectividad ni
 * credenciales: Medusa lo hace al arrancar el proveedor seleccionado.
 *
 * `SESSION_REDIS_URL` es independiente de `MEDUSA_REDIS_ENABLED`: configura
 * únicamente el almacén de sesiones de `express-session` documentado por
 * Medusa, no el Event Bus, workflows, caching ni locking.
 */
export function resolveRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfiguration {
  const isProduction = environment.NODE_ENV === "production"
  const deploymentEnvironment = resolveDeploymentEnvironment(environment)
  const allowHttpCookies = booleanFlag(environment, "ADMIN_ALLOW_HTTP")

  if (isProduction && allowHttpCookies) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ADMIN_ALLOW_HTTP=true no está permitido en producción.",
    )
  }

  const workerMode = (environment.WORKER_MODE ?? "shared").trim().toLowerCase()
  if (!WORKER_MODES.has(workerMode as WorkerMode)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "WORKER_MODE debe ser server, worker o shared.",
    )
  }

  const redisEnabled = booleanFlag(environment, "MEDUSA_REDIS_ENABLED")

  if (!redisEnabled) {
    const staleVariable = [
      "EVENTS_REDIS_URL",
      "WORKFLOW_REDIS_URL",
      "CACHE_REDIS_URL",
      "LOCKING_REDIS_URL",
    ].find((variable) => environment[variable]?.trim())

    if (staleVariable) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `${staleVariable} está definido pero MEDUSA_REDIS_ENABLED no es true.`,
      )
    }
  }

  if (redisEnabled && environment.MEDUSA_FF_CACHING !== "true") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "MEDUSA_FF_CACHING=true es obligatorio al activar Redis.",
    )
  }

  const redis: RedisConfiguration = redisEnabled
    ? {
        enabled: true,
        eventsUrl: requiredUrl(environment, "EVENTS_REDIS_URL", ["redis:", "rediss:"]),
        workflowUrl: requiredUrl(environment, "WORKFLOW_REDIS_URL", ["redis:", "rediss:"]),
        cacheUrl: requiredUrl(environment, "CACHE_REDIS_URL", ["redis:", "rediss:"]),
        lockingUrl: requiredUrl(environment, "LOCKING_REDIS_URL", ["redis:", "rediss:"]),
      }
    : { enabled: false }

  const sessionRedisUrl = environment.SESSION_REDIS_URL?.trim()
    ? requiredUrl(environment, "SESSION_REDIS_URL", ["redis:", "rediss:"])
    : undefined

  const allowLocalStorageInStaging = booleanFlag(
    environment,
    "STAGING_ALLOW_LOCAL_STORAGE",
  )
  if (
    allowLocalStorageInStaging &&
    deploymentEnvironment === "production"
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "STAGING_ALLOW_LOCAL_STORAGE=true no está permitido en producción.",
    )
  }

  const fileProvider = (environment.FILE_STORAGE_PROVIDER ?? "local")
    .trim()
    .toLowerCase()
  let file: FileConfiguration

  if (fileProvider === "local") {
    file = { provider: "local" }
  } else if (fileProvider === "s3") {
    file = {
      provider: "s3",
      fileUrl: requiredUrl(environment, "S3_FILE_URL", ["http:", "https:"]).replace(/\/+$/, ""),
      accessKeyId: required(environment, "S3_ACCESS_KEY_ID"),
      secretAccessKey: required(environment, "S3_SECRET_ACCESS_KEY"),
      region: required(environment, "S3_REGION"),
      bucket: required(environment, "S3_BUCKET"),
      endpoint: environment.S3_ENDPOINT ? requiredUrl(environment, "S3_ENDPOINT", ["http:", "https:"]) : undefined,
    }
  } else {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "FILE_STORAGE_PROVIDER debe ser local o s3.",
    )
  }

  return {
    workerMode: workerMode as WorkerMode,
    deploymentEnvironment,
    secureSessionCookie: isProduction,
    allowLocalStorageInStaging,
    sessionRedisUrl,
    redis,
    file,
  }
}
