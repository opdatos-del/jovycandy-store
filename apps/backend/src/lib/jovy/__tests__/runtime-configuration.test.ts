import { resolveRuntimeConfiguration } from "@jovy/lib/jovy/runtime-configuration"

const baseEnvironment = {
  NODE_ENV: "development",
} as NodeJS.ProcessEnv

describe("configuración de runtime", () => {
  it("mantiene proveedores locales y modo shared por defecto", () => {
    expect(resolveRuntimeConfiguration(baseEnvironment)).toMatchObject({
      workerMode: "shared",
      deploymentEnvironment: "development",
      redis: { enabled: false },
      file: { provider: "local" },
    })
  })

  it("rechaza cookies HTTP en producción", () => {
    expect(() =>
      resolveRuntimeConfiguration({ ...baseEnvironment, NODE_ENV: "production", ADMIN_ALLOW_HTTP: "true" }),
    ).toThrow("ADMIN_ALLOW_HTTP=true no está permitido en producción")
  })

  it("exige URLs separadas al activar infraestructura Redis", () => {
    expect(() =>
      resolveRuntimeConfiguration({
        ...baseEnvironment,
        MEDUSA_REDIS_ENABLED: "true",
        MEDUSA_FF_CACHING: "true",
      }),
    ).toThrow("EVENTS_REDIS_URL")
  })

  it("exige feature flag de caching al activar Redis", () => {
    expect(() =>
      resolveRuntimeConfiguration({ ...baseEnvironment, MEDUSA_REDIS_ENABLED: "true" }),
    ).toThrow("MEDUSA_FF_CACHING=true")
  })

  it("admite Redis segregado y worker separado", () => {
    expect(
      resolveRuntimeConfiguration({
        ...baseEnvironment,
        WORKER_MODE: "worker",
        MEDUSA_REDIS_ENABLED: "true",
        MEDUSA_FF_CACHING: "true",
        EVENTS_REDIS_URL: "redis://events",
        WORKFLOW_REDIS_URL: "redis://workflows",
        CACHE_REDIS_URL: "redis://cache",
        LOCKING_REDIS_URL: "redis://locking",
      }),
    ).toMatchObject({
      workerMode: "worker",
      redis: { enabled: true, eventsUrl: "redis://events", workflowUrl: "redis://workflows" },
    })
  })

  it("rechaza URLs Redis con protocolo no permitido", () => {
    expect(() =>
      resolveRuntimeConfiguration({
        ...baseEnvironment,
        MEDUSA_REDIS_ENABLED: "true",
        MEDUSA_FF_CACHING: "true",
        EVENTS_REDIS_URL: "https://redis.example.test",
        WORKFLOW_REDIS_URL: "redis://workflows",
        CACHE_REDIS_URL: "redis://cache",
        LOCKING_REDIS_URL: "redis://locking",
      }),
    ).toThrow("EVENTS_REDIS_URL debe usar")
  })

  it("exige configuración S3 completa cuando se selecciona", () => {
    expect(() =>
      resolveRuntimeConfiguration({ ...baseEnvironment, FILE_STORAGE_PROVIDER: "s3" }),
    ).toThrow("S3_FILE_URL")
  })

  it("rechaza URLs Redis vacías y malformadas", () => {
    const redisBase = {
      ...baseEnvironment,
      MEDUSA_REDIS_ENABLED: "true",
      MEDUSA_FF_CACHING: "true",
    }

    expect(() =>
      resolveRuntimeConfiguration({ ...redisBase, EVENTS_REDIS_URL: "   " }),
    ).toThrow("EVENTS_REDIS_URL es obligatorio")

    expect(() =>
      resolveRuntimeConfiguration({
        ...redisBase,
        EVENTS_REDIS_URL: "not-a-url",
        WORKFLOW_REDIS_URL: "redis://workflows",
        CACHE_REDIS_URL: "redis://cache",
        LOCKING_REDIS_URL: "redis://locking",
      }),
    ).toThrow("EVENTS_REDIS_URL debe ser una URL válida")
  })

  it("rechaza valores desconocidos de modo, flags y perfil", () => {
    expect(() =>
      resolveRuntimeConfiguration({ ...baseEnvironment, WORKER_MODE: "all" }),
    ).toThrow("WORKER_MODE debe ser server, worker o shared")

    expect(() =>
      resolveRuntimeConfiguration({ ...baseEnvironment, MEDUSA_REDIS_ENABLED: "yes" }),
    ).toThrow("MEDUSA_REDIS_ENABLED debe ser true o false")

    expect(() =>
      resolveRuntimeConfiguration({ ...baseEnvironment, ADMIN_ALLOW_HTTP: "enabled" }),
    ).toThrow("ADMIN_ALLOW_HTTP debe ser true o false")

    expect(() =>
      resolveRuntimeConfiguration({ ...baseEnvironment, DEPLOYMENT_ENV: "qa" }),
    ).toThrow("DEPLOYMENT_ENV debe ser development, staging o production")

    expect(() =>
      resolveRuntimeConfiguration({ ...baseEnvironment, FILE_STORAGE_PROVIDER: "gcs" }),
    ).toThrow("FILE_STORAGE_PROVIDER debe ser local o s3")
  })

  it("rechaza URLs Redis huérfanas cuando el perfil está desactivado", () => {
    expect(() =>
      resolveRuntimeConfiguration({
        ...baseEnvironment,
        EVENTS_REDIS_URL: "redis://events",
      }),
    ).toThrow("EVENTS_REDIS_URL está definido pero MEDUSA_REDIS_ENABLED no es true")
  })

  it("resuelve el perfil explícito y el Redis de sesiones por separado", () => {
    expect(
      resolveRuntimeConfiguration({
        ...baseEnvironment,
        DEPLOYMENT_ENV: "staging",
        SESSION_REDIS_URL: "rediss://sessions.example.test:6379",
      }),
    ).toMatchObject({
      deploymentEnvironment: "staging",
      sessionRedisUrl: "rediss://sessions.example.test:6379",
      redis: { enabled: false },
    })
  })

  it("rechaza sesiones Redis con protocolo inseguro", () => {
    expect(() =>
      resolveRuntimeConfiguration({
        ...baseEnvironment,
        SESSION_REDIS_URL: "http://sessions.example.test",
      }),
    ).toThrow("SESSION_REDIS_URL debe usar")
  })

  it("normaliza proveedor y modo sin distinguir mayúsculas", () => {
    expect(
      resolveRuntimeConfiguration({
        ...baseEnvironment,
        WORKER_MODE: " WORKER ",
        FILE_STORAGE_PROVIDER: "LOCAL",
      }),
    ).toMatchObject({ workerMode: "worker", file: { provider: "local" } })
  })
})
