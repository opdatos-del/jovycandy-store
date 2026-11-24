import { resolveRuntimeConfiguration } from "@jovy/lib/jovy/runtime-configuration"

const baseEnvironment = {
  NODE_ENV: "development",
} as NodeJS.ProcessEnv

describe("configuración de runtime", () => {
  it("mantiene proveedores locales y modo shared por defecto", () => {
    expect(resolveRuntimeConfiguration(baseEnvironment)).toMatchObject({
      workerMode: "shared",
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
})
