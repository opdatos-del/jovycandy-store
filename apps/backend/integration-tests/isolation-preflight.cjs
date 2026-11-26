"use strict"

const {
  assertLocalIntegrationEnvironment,
  suiteDatabaseName,
  validateClusterIdentity,
  validateEnvironment,
} = require("./ephemeral-postgres.cjs")

function preflight(env = process.env) {
  return assertLocalIntegrationEnvironment(env)
}

module.exports = {
  preflight,
  suiteDatabaseName,
  validateEnvironment,
  validateServer: validateClusterIdentity,
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(preflight()))
  } catch (error) {
    console.error(`Preflight rechazado: ${error.message}`)
    process.exitCode = 1
  }
}
