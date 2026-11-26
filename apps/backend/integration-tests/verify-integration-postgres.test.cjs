"use strict"

const assert = require("node:assert/strict")
const test = require("node:test")
const {
  CI_SERVER_QUERY,
  verifyCiPostgresConnection,
} = require("./verify-integration-postgres.cjs")

function ciEnvironment() {
  return {
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
}

function createClient(row) {
  return class Client {
    async connect() {}

    async query(query) {
      assert.equal(query, CI_SERVER_QUERY)
      return { rows: [row] }
    }

    async end() {}
  }
}

test("CI consulta identidad del servicio PostgreSQL antes de ejecutar Jest", async () => {
  await assert.doesNotReject(() =>
    verifyCiPostgresConnection(ciEnvironment(), {
      lookup: async () => [{ address: "127.0.0.1" }],
      platform: "linux",
      ClientCtor: createClient({
        user: "postgres",
        database: "medusa_ci_http",
        server_port: 5432,
        version: "PostgreSQL 16.11 on x86_64-pc-linux-gnu",
      }),
    }),
  )
})

test("CI rechaza un servidor que no coincide aunque las variables sean válidas", async () => {
  await assert.rejects(() =>
    verifyCiPostgresConnection(ciEnvironment(), {
      lookup: async () => [{ address: "127.0.0.1" }],
      platform: "linux",
      ClientCtor: createClient({
        user: "postgres",
        database: "otra_base",
        server_port: 5432,
        version: "PostgreSQL 16.11 on x86_64-pc-linux-gnu",
      }),
    }),
  )
})
