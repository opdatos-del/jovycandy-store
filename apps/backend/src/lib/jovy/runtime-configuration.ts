import { MedusaError } from "@medusajs/framework/utils"

type WorkerMode = "server" | "worker" | "shared"

type RedisConfiguration =
  | { enabled: false }
  | {
      enabled: true
      eventsUrl: string
      workflowUrl: string
      cacheUrl: string
      lockingUrl: string
    }

type FileConfiguration =
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
  secureSessionCookie: boolean
  redis: RedisConfiguration
  file: FileConfiguration
}

const WORKER_MODES = new Set<WorkerMode>(["server", "worker", "shared"])

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

/**
 * Resuelve perfiles explícitos de infraestructura sin registrar proveedores
 * externos durante desarrollo local. Esta función no valida conectividad ni
 * credenciales: Medusa lo hace al arrancar el proveedor seleccionado.
 */
export function resolveRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfiguration {
  const isProduction = environment.NODE_ENV === "production"
  const allowHttpCookies = environment.ADMIN_ALLOW_HTTP === "true"

  if (isProduction && allowHttpCookies) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ADMIN_ALLOW_HTTP=true no está permitido en producción.",
    )
  }

  const workerMode = (environment.WORKER_MODE ?? "shared").trim()
  if (!WORKER_MODES.has(workerMode as WorkerMode)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "WORKER_MODE debe ser server, worker o shared.",
    )
  }

  const redisEnabled = environment.MEDUSA_REDIS_ENABLED === "true"
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

  const fileProvider = environment.FILE_STORAGE_PROVIDER ?? "local"
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
    secureSessionCookie: isProduction,
    redis,
    file,
  }
}
