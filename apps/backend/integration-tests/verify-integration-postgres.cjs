"use strict"

const dns = require("node:dns").promises
const { Client } = require("@medusajs/framework/pg")
const {
  assertLocalIntegrationEnvironment,
  LOOPBACK_HOST,
  validateClusterIdentity,
} = require("./ephemeral-postgres.cjs")
const {
  validateLoopback,
  verifyMedusaConnection,
} = require("./verify-medusa-connection.cjs")

const CI_SERVER_QUERY = [
  "SELECT",
  "current_user AS user,",
  "current_database() AS database,",
  "inet_server_port() AS server_port,",
  "version() AS version",
].join(" ")

async function verifyCiPostgresConnection(
  env = process.env,
  { lookup = dns.lookup, ClientCtor = Client, platform = process.platform } = {},
) {
  const expected = assertLocalIntegrationEnvironment(env, { platform })
  if (expected.mode !== "ci-service") {
    throw new Error("La verificación CI requiere el servicio PostgreSQL autorizado")
  }

  const addresses = await lookup(LOOPBACK_HOST, { all: true })
  validateLoopback(addresses)
  const client = new ClientCtor({
    host: LOOPBACK_HOST,
    port: expected.port,
    user: expected.user,
    password: env.DB_PASSWORD,
    database: expected.database,
    connectionTimeoutMillis: 5000,
  })
  try {
    await client.connect()
    const { rows } = await client.query(CI_SERVER_QUERY)
    const server = rows[0]
    if (
      !server ||
      server.user !== expected.user ||
      server.database !== expected.database ||
      Number(server.server_port) !== expected.port ||
      !/^PostgreSQL 16\./.test(String(server.version))
    ) {
      throw new Error("La identidad del servicio PostgreSQL CI no coincide")
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}

/**
 * Jest espera una función async de globalSetup. Corre antes de cargar suites:
 * la excepción CI se concede solo tras consultar el servidor PostgreSQL real.
 */
module.exports = async function verifyIntegrationPostgres() {
  const expected = assertLocalIntegrationEnvironment(process.env)
  if (expected.mode === "ci-service") {
    await verifyCiPostgresConnection(process.env)
    return
  }

  const server = await verifyMedusaConnection(process.env)
  validateClusterIdentity(server, expected)
}

module.exports.CI_SERVER_QUERY = CI_SERVER_QUERY
module.exports.verifyCiPostgresConnection = verifyCiPostgresConnection
