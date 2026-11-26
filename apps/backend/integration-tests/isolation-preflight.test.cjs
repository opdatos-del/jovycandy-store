"use strict"

const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const { spawnSync } = require("node:child_process")
const {
  assertLocalIntegrationEnvironment,
  assertSafePort,
  assertTestType,
  buildLaunchEnvironment,
  createRunDirectory,
  createRunIdentity,
  suiteDatabaseName,
  validateClusterIdentity,
  validateCiServiceEnvironment,
  validateEnvironment,
  writeRunMarker,
} = require("./ephemeral-postgres.cjs")

function createFixture() {
  const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), "jovycandy-it-"))
  const identity = createRunIdentity("0c0c0c0c-1111-4aaa-8bbb-222222222222")
  const root = createRunDirectory(localAppData, identity.runId)
  const metadata = {
    ...identity,
    root,
    dataDirectory: path.join(root, "data"),
    port: 44321,
    postgresPid: 9876,
  }
  writeRunMarker(root, metadata)
  const environment = buildLaunchEnvironment({ LOCALAPPDATA: localAppData }, metadata, "temporary-password")
  return { environment, localAppData, metadata }
}

test("genera nombres distintos y acotados para suite y ejecución", () => {
  const first = suiteDatabaseName("0c0c0c0c-1111-4aaa-8bbb-222222222222", "integration-tests/http/content-store.spec.ts")
  assert.match(first, /^jovy_it_[0-9a-f]{12}_[0-9a-f]{12}$/)
  assert.ok(Buffer.byteLength(`${first}-template`) <= 63)
  assert.notEqual(first, suiteDatabaseName("1c0c0c0c-1111-4aaa-8bbb-222222222222", "integration-tests/http/content-store.spec.ts"))
  assert.notEqual(first, suiteDatabaseName("0c0c0c0c-1111-4aaa-8bbb-222222222222", "integration-tests/http/other.spec.ts"))
  assert.throws(() => suiteDatabaseName("bad", "suite"))
  assert.throws(() => suiteDatabaseName("0c0c0c0c-1111-4aaa-8bbb-222222222222", "../suite"))
})

test("acepta solo variables generadas por el launcher efímero", (t) => {
  const fixture = createFixture()
  t.after(() => fs.rmSync(fixture.localAppData, { recursive: true, force: true }))

  const actual = validateEnvironment(fixture.environment, fixture.metadata)
  assert.equal(actual.port, fixture.metadata.port)
  assert.equal(actual.user, fixture.metadata.user)
  assert.equal(actual.cluster, fixture.metadata.cluster)
  assert.equal(new URL(fixture.environment.DATABASE_URL).hostname, "localhost")
})

test("rechaza puertos persistentes y variables contradictorias antes de conectar", (t) => {
  const fixture = createFixture()
  t.after(() => fs.rmSync(fixture.localAppData, { recursive: true, force: true }))

  assert.throws(() => assertSafePort(5432))
  assert.throws(() => assertSafePort(55432))
  assert.throws(() => validateEnvironment({ ...fixture.environment, DB_HOST: "127.0.0.1" }, fixture.metadata))
  assert.throws(() => validateEnvironment({ ...fixture.environment, DB_PORT: "5432" }, fixture.metadata))
  assert.throws(() => validateEnvironment({ ...fixture.environment, PGOPTIONS: "-c port=5432" }, fixture.metadata))
  assert.throws(() => validateEnvironment({ ...fixture.environment, DATABASE_URL: "postgres://other:password@localhost:44321/postgres" }, fixture.metadata))
})

test("Jest rechaza TEST_TYPE ausente o no autorizado antes de descubrir suites", () => {
  assert.throws(() => assertTestType(undefined))
  assert.throws(() => assertTestType("integration"))
  assert.doesNotThrow(() => assertTestType("unit"))

  const env = { ...process.env }
  delete env.TEST_TYPE
  const result = spawnSync(process.execPath, ["-e", "require('./jest.config.js')"], {
    cwd: path.resolve(__dirname, ".."),
    env,
    encoding: "utf8",
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stderr}${result.stdout}`, /TEST_TYPE debe ser unit/)
})

test("CI exige identidad estática coherente con la suite", () => {
  const base = {
    CI: "true",
    JOVY_CI_POSTGRES_SERVICE: "1",
    JOVY_CI_POSTGRES_DATABASE: "medusa_ci_http",
    TEST_TYPE: "integration:http",
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_USERNAME: "postgres",
    DB_PASSWORD: "postgres",
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/medusa_ci_http",
  }
  assert.doesNotThrow(() => validateCiServiceEnvironment(base, { platform: "linux" }))
  assert.throws(() => validateCiServiceEnvironment({ ...base, JOVY_CI_POSTGRES_DATABASE: "medusa_ci_modules" }, { platform: "linux" }))
  assert.throws(() => validateCiServiceEnvironment({ ...base, DATABASE_URL: "postgres://postgres:postgres@localhost:5432/medusa_ci_modules" }, { platform: "linux" }))
  assert.throws(() => assertLocalIntegrationEnvironment({ ...base, CI: "false" }))
})

test("rechaza identidad PostgreSQL distinta de la ejecución actual", (t) => {
  const fixture = createFixture()
  t.after(() => fs.rmSync(fixture.localAppData, { recursive: true, force: true }))

  const server = {
    user: fixture.metadata.user,
    host: "127.0.0.1",
    port: fixture.metadata.port,
    directory: fixture.metadata.dataDirectory,
    cluster: fixture.metadata.cluster,
  }
  assert.doesNotThrow(() => validateClusterIdentity(server, fixture.metadata))
  assert.throws(() => validateClusterIdentity({ ...server, port: 5432 }, fixture.metadata))
  assert.throws(() => validateClusterIdentity({ ...server, directory: "C:\\unknown\\data" }, fixture.metadata))
  assert.throws(() => validateClusterIdentity({ ...server, cluster: "unknown" }, fixture.metadata))
})
