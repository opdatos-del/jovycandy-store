const test = require("node:test")
const assert = require("node:assert/strict")
const { suiteDatabaseName, validateEnvironment, validateServer } = require("./isolation-preflight.cjs")

test("genera nombres distintos y acotados para suite y ejecución", () => {
  const first = suiteDatabaseName("a123456789ab", "integration-tests/http/content-store.spec.ts")
  assert.match(first, /^jovy_it_[0-9a-f]{12}_[0-9a-f]{12}$/)
  assert.ok(Buffer.byteLength(first + "-template") <= 63)
  assert.notEqual(first, suiteDatabaseName("b123456789ab", "integration-tests/http/content-store.spec.ts"))
  assert.notEqual(first, suiteDatabaseName("a123456789ab", "integration-tests/http/other.spec.ts"))
  assert.throws(() => suiteDatabaseName("bad", "suite"))
  assert.throws(() => suiteDatabaseName("a123456789ab", "../suite"))
})

test("acepta configuración ausente o coincidente", () => {
  assert.doesNotThrow(() => validateEnvironment({}))
  assert.doesNotThrow(() => validateEnvironment({ DB_HOST: "127.0.0.1", DB_PORT: "55432", DB_USERNAME: "jovy_test" }))
})

test("rechaza una identidad de servidor desconocida", () => {
  const server = { user: "jovy_test", host: "127.0.0.1", port: 55432, directory: "c:/cluster/data", cluster: "jovy_disposable_f002598ccccd4f44b0f0a066e00fe7ad" }
  assert.doesNotThrow(() => validateServer(server, "c:/cluster/data"))
  assert.throws(() => validateServer({ ...server, cluster: "otro" }, "c:/cluster/data"))
  assert.throws(() => validateServer(server, "c:/otro/data"))
})

test("rechaza 5432 y variables contradictorias antes de conectar", () => {
  assert.throws(() => validateEnvironment({ DB_PORT: "5432" }))
  assert.throws(() => validateEnvironment({ DB_HOST: "localhost" }))
  assert.throws(() => validateEnvironment({ DB_USERNAME: "postgres" }))
  assert.throws(() => validateEnvironment({ DATABASE_URL: "postgres://jovy_test:secret@127.0.0.1:5432/postgres" }))
  assert.throws(() => validateEnvironment({ DATABASE_URL: "postgres://jovy_test:secret@127.0.0.1:55432/postgres?host=other" }))
  assert.throws(() => validateEnvironment({ DB_WAITINGROOM_DATABASE: "other" }))
  assert.throws(() => validateEnvironment({ PGOPTIONS: "-c port=5432" }))
  assert.throws(() => validateEnvironment({ PGHOSTADDR: "127.0.0.1" }))
  assert.throws(() => validateEnvironment({ PGPASSFILE: "otro" }))
  assert.throws(() => validateEnvironment({ PGSSLMODE: "require" }))
})
