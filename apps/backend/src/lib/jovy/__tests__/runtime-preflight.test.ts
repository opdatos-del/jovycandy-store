import {
  assertRuntimePreflight,
  collectRuntimePreflightIssues,
  formatRuntimePreflightIssues,
} from "@jovy/lib/jovy/runtime-preflight"
import {
  resolveRuntimeConfiguration,
  type RuntimeConfiguration,
} from "@jovy/lib/jovy/runtime-configuration"

// Valores construidos en ejecución: evitan que el escáner los trate como
// credenciales versionadas sin reducir la cobertura de longitud y entropía.
const buildTestSecret = (length: number, offset = 0) =>
  Array.from({ length }, (_, index) =>
    String.fromCharCode(97 + ((index + offset) % 26)),
  ).join("")
const TEST_SECRET = buildTestSecret(40)
const SECOND_SECRET = buildTestSecret(40, 7)
const TEST_MFA_KEY = Array.from({ length: 64 }, (_, index) =>
  (index % 16).toString(16),
).join("")
const TEST_REDIS_PASSWORD = buildTestSecret(32, 3)

const deployedEnvironment = {
  NODE_ENV: "production",
  DEPLOYMENT_ENV: "staging",
  DATABASE_URL: "postgres://jovy:database-password@db.internal:5432/jovycandy",
  JWT_SECRET: TEST_SECRET,
  COOKIE_SECRET: SECOND_SECRET,
  AUTH_MFA_ENCRYPTION_KEY: TEST_MFA_KEY,
  JOVY_COMMERCE_SECRET: TEST_SECRET,
  JOVY_REVALIDATION_SECRET: SECOND_SECRET,
  REDIS_PASSWORD: TEST_REDIS_PASSWORD,
  STORE_CORS: "https://shop.example.test",
  ADMIN_CORS: "https://admin.example.test",
  AUTH_CORS: "https://shop.example.test,https://admin.example.test",
  MEDUSA_REDIS_ENABLED: "true",
  MEDUSA_FF_CACHING: "true",
  EVENTS_REDIS_URL: "rediss://events.example.test:6379",
  WORKFLOW_REDIS_URL: "rediss://workflows.example.test:6379",
  CACHE_REDIS_URL: "rediss://cache.example.test:6379",
  LOCKING_REDIS_URL: "rediss://locking.example.test:6379",
  SESSION_REDIS_URL: "rediss://sessions.example.test:6379",
  FILE_STORAGE_PROVIDER: "s3",
  S3_FILE_URL: "https://cdn.example.test/jovycandy",
  S3_ACCESS_KEY_ID: "AKIAJOVYLAB123",
  S3_SECRET_ACCESS_KEY: TEST_SECRET,
  S3_REGION: "us-east-1",
  S3_BUCKET: "jovycandy-staging",
  S3_ENDPOINT: "https://s3.example.test",
} as NodeJS.ProcessEnv

function without(
  environment: NodeJS.ProcessEnv,
  ...variables: string[]
): NodeJS.ProcessEnv {
  const copy = { ...environment }
  for (const variable of variables) delete copy[variable]
  return copy
}

function issuesFor(
  overrides: NodeJS.ProcessEnv = {},
  base: NodeJS.ProcessEnv = deployedEnvironment,
) {
  const environment = { ...base, ...overrides }
  let configuration: RuntimeConfiguration
  try {
    configuration = resolveRuntimeConfiguration(environment)
  } catch {
    // Las combinaciones que fallan al resolver se comprueban en su propio test.
    return collectRuntimePreflightIssues(
      {
        workerMode: "shared",
        deploymentEnvironment: "staging",
        secureSessionCookie: true,
        allowLocalStorageInStaging: false,
        redis: { enabled: false },
        file: { provider: "local" },
      },
      environment,
    )
  }

  return collectRuntimePreflightIssues(configuration, environment)
}

function errorsFor(
  overrides: NodeJS.ProcessEnv = {},
  base: NodeJS.ProcessEnv = deployedEnvironment,
) {
  return issuesFor(overrides, base).filter((entry) => entry.level === "error")
}

describe("preflight de runtime", () => {
  it("acepta un perfil de staging completo", () => {
    expect(errorsFor()).toEqual([])
  })

  it("no aplica reglas de despliegue a development explícito", () => {
    const environment = {
      NODE_ENV: "development",
      DEPLOYMENT_ENV: "development",
      DATABASE_URL: "postgres://postgres:local@127.0.0.1:5432/jovycandy",
      JWT_SECRET: "GENERATE_A_UNIQUE_LOCAL_SECRET",
      COOKIE_SECRET: "GENERATE_A_UNIQUE_LOCAL_SECRET",
      STORE_CORS: "http://localhost:3000",
      ADMIN_CORS: "http://localhost:9000",
      AUTH_CORS: "http://localhost:3000,http://localhost:9000",
      FILE_STORAGE_PROVIDER: "local",
    } as NodeJS.ProcessEnv

    expect(
      collectRuntimePreflightIssues(
        resolveRuntimeConfiguration(environment),
        environment,
      ).filter((entry) => entry.level === "error"),
    ).toEqual([])
  })

  it("trata NODE_ENV=production sin perfil explícito como producción", () => {
    const environment = {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/medusa_build",
      JWT_SECRET: "ci-build-only-jwt-secret",
      COOKIE_SECRET: "ci-build-only-cookie-secret",
      STORE_CORS: "http://localhost:3000",
      ADMIN_CORS: "http://localhost:9000",
      AUTH_CORS: "http://localhost:3000,http://localhost:9000",
    } as NodeJS.ProcessEnv

    const issues = collectRuntimePreflightIssues(
      resolveRuntimeConfiguration(environment),
      environment,
    )

    expect(
      issues.filter((entry) => entry.level === "error").length,
    ).toBeGreaterThan(0)
  })

  it("exige base de datos PostgreSQL válida y no loopback", () => {
    expect(
      errorsFor({}, without(deployedEnvironment, "DATABASE_URL")),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "DATABASE_URL", level: "error" }),
      ]),
    )

    expect(
      errorsFor({ DATABASE_URL: "mysql://user:pass@db.internal/jovy" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "DATABASE_URL" }),
      ]),
    )

    expect(
      errorsFor({ DATABASE_URL: "postgres://jovy:pass@127.0.0.1/jovy" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable: "DATABASE_URL",
          message: expect.stringContaining("loopback"),
        }),
      ]),
    )
  })

  it("rechaza secretos ausentes, cortos o repetidos", () => {
    expect(
      errorsFor({}, without(deployedEnvironment, "JWT_SECRET")),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "JWT_SECRET" }),
      ]),
    )

    expect(errorsFor({ JWT_SECRET: "short" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable: "JWT_SECRET",
          message: expect.stringContaining("32"),
        }),
      ]),
    )

    expect(
      errorsFor({ COOKIE_SECRET: deployedEnvironment.JWT_SECRET }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable: "JWT_SECRET",
          message: expect.stringContaining("distintos"),
        }),
      ]),
    )

    expect(
      errorsFor({ AUTH_MFA_ENCRYPTION_KEY: "too-short" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "AUTH_MFA_ENCRYPTION_KEY" }),
      ]),
    )
  })

  it("exige CORS exactos y HTTPS en despliegue", () => {
    expect(
      errorsFor({ STORE_CORS: "https://shop.example.test/" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "STORE_CORS" }),
      ]),
    )

    expect(errorsFor({ STORE_CORS: "*" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "STORE_CORS" }),
      ]),
    )

    expect(errorsFor({ ADMIN_CORS: "http://admin.example.test" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable: "ADMIN_CORS",
          message: expect.stringContaining("HTTPS"),
        }),
      ]),
    )

    expect(
      errorsFor({ AUTH_CORS: "https://shop.example.test,http://localhost:9000" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variable: "AUTH_CORS",
          message: expect.stringContaining("loopback"),
        }),
      ]),
    )
  })

  it("exige Redis compartido cuando server y worker están separados", () => {
    const withoutRedis = without(
      deployedEnvironment,
      "MEDUSA_REDIS_ENABLED",
      "MEDUSA_FF_CACHING",
      "EVENTS_REDIS_URL",
      "WORKFLOW_REDIS_URL",
      "CACHE_REDIS_URL",
      "LOCKING_REDIS_URL",
    )

    expect(errorsFor({ WORKER_MODE: "server" }, withoutRedis)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "MEDUSA_REDIS_ENABLED" }),
      ]),
    )
  })

  it("rechaza almacenamiento local en staging y S3 inseguro", () => {
    const withoutS3 = without(
      deployedEnvironment,
      "FILE_STORAGE_PROVIDER",
      "S3_FILE_URL",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ENDPOINT",
    )

    expect(errorsFor({}, withoutS3)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "FILE_STORAGE_PROVIDER" }),
      ]),
    )

    expect(errorsFor({ S3_FILE_URL: "http://cdn.example.test/jovy" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "S3_FILE_URL" }),
      ]),
    )

    expect(
      errorsFor({ S3_ENDPOINT: "http://s3.example.test" }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "S3_ENDPOINT" }),
      ]),
    )
  })

  it("permite file-local solo con excepción explícita de staging", () => {
    const withoutS3 = without(
      deployedEnvironment,
      "FILE_STORAGE_PROVIDER",
      "S3_FILE_URL",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ENDPOINT",
    )

    const stagingEnvironment = {
      ...withoutS3,
      STAGING_ALLOW_LOCAL_STORAGE: "true",
    }
    const stagingConfiguration = resolveRuntimeConfiguration(
      stagingEnvironment,
    )
    const stagingIssues = collectRuntimePreflightIssues(
      stagingConfiguration,
      stagingEnvironment,
    )

    expect(stagingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "warning",
          variable: "FILE_STORAGE_PROVIDER",
        }),
      ]),
    )
    expect(
      stagingIssues.filter((entry) => entry.level === "error"),
    ).toEqual([])

    expect(() =>
      resolveRuntimeConfiguration({
        ...stagingEnvironment,
        DEPLOYMENT_ENV: "production",
      }),
    ).toThrow("STAGING_ALLOW_LOCAL_STORAGE=true no está permitido")
  })

  it("acepta el perfil Compose de staging con HTTPS por IP y storage local", () => {
    const environment = {
      ...without(
        deployedEnvironment,
        "S3_FILE_URL",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "S3_REGION",
        "S3_BUCKET",
        "S3_ENDPOINT",
      ),
      DATABASE_URL: "postgres://jovy:database-password@postgres:5432/jovycandy_staging",
      STORE_CORS: "https://203.0.113.10",
      ADMIN_CORS: "https://203.0.113.10",
      AUTH_CORS: "https://203.0.113.10",
      FILE_STORAGE_PROVIDER: "local",
      STAGING_ALLOW_LOCAL_STORAGE: "true",
    } as NodeJS.ProcessEnv

    const issues = collectRuntimePreflightIssues(
      resolveRuntimeConfiguration(environment),
      environment,
    )

    expect(issues.filter((entry) => entry.level === "error")).toEqual([])
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "warning",
          variable: "FILE_STORAGE_PROVIDER",
        }),
      ]),
    )
  })

  it("informa sesiones en memoria sin bloquear un servidor único", () => {
    const issues = issuesFor({}, without(deployedEnvironment, "SESSION_REDIS_URL"))

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "warning",
          variable: "SESSION_REDIS_URL",
        }),
      ]),
    )
    expect(issues.filter((entry) => entry.level === "error")).toEqual([])
  })

  it("rechaza staging sin NODE_ENV=production", () => {
    expect(errorsFor({ NODE_ENV: "development" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "NODE_ENV" }),
      ]),
    )
  })

  it("falla el arranque ante errores y respeta las advertencias", () => {
    const invalidEnvironment = {
      ...deployedEnvironment,
      DATABASE_URL: "postgres://jovy:pass@127.0.0.1:5432/jovy",
    }
    expect(() =>
      assertRuntimePreflight(
        resolveRuntimeConfiguration(invalidEnvironment),
        invalidEnvironment,
      ),
    ).toThrow("Preflight de runtime falló")

    const warningEnvironment = without(
      deployedEnvironment,
      "SESSION_REDIS_URL",
    )
    expect(() =>
      assertRuntimePreflight(
        resolveRuntimeConfiguration(warningEnvironment),
        warningEnvironment,
      ),
    ).not.toThrow()
  })

  it("rechaza secretos públicos de ejemplo o de baja entropía", () => {
    const issues = errorsFor({
      JWT_SECRET: "x".repeat(64),
      COOKIE_SECRET: "y".repeat(64),
      AUTH_MFA_ENCRYPTION_KEY: "0".repeat(64),
      JOVY_COMMERCE_SECRET: "z".repeat(64),
      JOVY_REVALIDATION_SECRET: "w".repeat(64),
      REDIS_PASSWORD: "replace-with-generated-secret",
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variable: "JWT_SECRET" }),
        expect.objectContaining({ variable: "AUTH_MFA_ENCRYPTION_KEY" }),
        expect.objectContaining({ variable: "JOVY_COMMERCE_SECRET" }),
        expect.objectContaining({ variable: "JOVY_REVALIDATION_SECRET" }),
        expect.objectContaining({ variable: "REDIS_PASSWORD" }),
      ]),
    )
  })

  it("formatea el informe sin exponer valores sensibles", () => {
    const report = formatRuntimePreflightIssues(
      errorsFor({ JWT_SECRET: TEST_SECRET, COOKIE_SECRET: TEST_SECRET }),
    )

    expect(report).toContain("JWT_SECRET")
    expect(report).not.toContain(TEST_SECRET)
  })
})
