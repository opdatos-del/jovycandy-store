"use strict"

const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const {
  assertSafePort,
  buildLaunchEnvironment,
  createRunDirectory,
  createRunIdentity,
  suiteDatabaseName,
  validateClusterIdentity,
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
