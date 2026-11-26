"use strict"

const dns = require("node:dns").promises
const { Client } = require("@medusajs/framework/pg")
const {
  IPV4_LOOPBACK,
  LOOPBACK_HOST,
  environmentFromMarker,
  validateClusterIdentity,
  validateEnvironment,
} = require("./ephemeral-postgres.cjs")

function validateLoopback(addresses) {
  if (!addresses.length || addresses.some(({ address }) => address !== IPV4_LOOPBACK && address !== "::1")) {
    throw new Error("localhost resuelve fuera de loopback")
  }
}

/** Verifica DNS y conexión IPv4 con el cliente pg de Medusa, sin escrituras. */
async function verifyMedusaConnection(env = process.env) {
  const expected = validateEnvironment(env, environmentFromMarker(env))
  const addresses = await dns.lookup(LOOPBACK_HOST, { all: true })
  validateLoopback(addresses)
  const client = new Client({
    host: LOOPBACK_HOST,
    port: expected.port,
    user: expected.user,
    database: "postgres",
    password: env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
  })
  try {
    await client.connect()
    const socketRemote = client.connection.stream.remoteAddress
    const result = await client.query("SELECT current_user AS username, inet_client_addr()::text AS client_address, inet_server_port() AS port, current_setting('data_directory') AS directory, current_setting('cluster_name') AS cluster, current_setting('listen_addresses') AS listen_addresses")
    const row = result.rows[0]
    const clientAddress = String(row.client_address ?? "").replace(/\/32$/, "")
    if (clientAddress !== IPV4_LOOPBACK || socketRemote !== IPV4_LOOPBACK) {
      throw new Error("Conexión de Medusa fuera de IPv4 autorizada")
    }
    if (row.listen_addresses !== IPV4_LOOPBACK) {
      throw new Error("PostgreSQL no está configurado exclusivamente para IPv4 loopback")
    }
    const server = { ...row, user: row.username, host: clientAddress }
    validateClusterIdentity(server, expected)
    return {
      addresses,
      host: clientAddress,
      remote: socketRemote ?? row.client_address,
      port: row.port,
      user: row.username,
      directory: row.directory,
      cluster: row.cluster,
      listenAddresses: row.listen_addresses,
    }
  } finally {
    await client.end()
  }
}

module.exports = { validateLoopback, verifyMedusaConnection }
if (require.main === module) {
  verifyMedusaConnection().then((result) => console.log(JSON.stringify(result))).catch(() => {
    console.error("No se pudo verificar la conexión IPv4 con el cliente pg")
    process.exitCode = 1
  })
}
