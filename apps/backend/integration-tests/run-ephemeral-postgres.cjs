"use strict"

const fs = require("node:fs")
const net = require("node:net")
const path = require("node:path")
const { randomBytes } = require("node:crypto")
const { spawnSync } = require("node:child_process")
const {
  IPV4_LOOPBACK,
  assertSafePort,
  buildLaunchEnvironment,
  createRunDirectory,
  createRunIdentity,
  readOwnedRunMarker,
  redactSecrets,
  validateClusterIdentity,
  writeRunMarker,
} = require("./ephemeral-postgres.cjs")
const { verifyMedusaConnection } = require("./verify-medusa-connection.cjs")

const BACKEND_DIRECTORY = path.resolve(__dirname, "..")
const POSTGRES_BIN_DIRECTORY = path.join(
  process.env.ProgramFiles || "C:\\Program Files",
  "PostgreSQL",
  "18",
  "bin",
)
const BINARIES = {
  initdb: path.join(POSTGRES_BIN_DIRECTORY, "initdb.exe"),
  pgCtl: path.join(POSTGRES_BIN_DIRECTORY, "pg_ctl.exe"),
}

function fail(message) {
  throw new Error(message)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? BACKEND_DIRECTORY,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    windowsHide: true,
    env: options.env ?? process.env,
    maxBuffer: 10 * 1024 * 1024,
    stdio: options.stdio,
  })
  if (result.error) throw result.error
  return result
}

function assertWindowsPostgres() {
  if (process.platform !== "win32") fail("El launcher PostgreSQL efímero solo está disponible en Windows")
  for (const [name, binary] of Object.entries(BINARIES)) {
    if (!fs.existsSync(binary)) fail(`No se encontró PostgreSQL 18.6 (${name})`)
  }
}

function createPassword() {
  return randomBytes(36).toString("base64url")
}

async function findAvailablePort() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer()
      server.unref()
      server.once("error", reject)
      server.listen({ host: IPV4_LOOPBACK, port: 0 }, () => {
        const address = server.address()
        server.close((error) => (error ? reject(error) : resolve(address.port)))
      })
    })
    if (!new Set([5432, 55432]).has(port)) return assertSafePort(port)
  }
  fail("No se encontró un puerto IPv4 seguro para PostgreSQL efímero")
}

function appendPostgresConfiguration(dataDirectory, port, cluster) {
  const configuration = [
    "",
    "# JovyCandy integration launcher: generated per exclusive test run",
    "listen_addresses = '127.0.0.1'",
    `port = ${assertSafePort(port)}`,
    "password_encryption = 'scram-sha-256'",
    `cluster_name = '${cluster}'`,
    "",
  ].join("\n")
  fs.appendFileSync(path.join(dataDirectory, "postgresql.conf"), configuration, "utf8")
}

function initializeCluster(metadata, password) {
  const passwordFile = path.join(metadata.root, "initdb-password.txt")
  fs.writeFileSync(passwordFile, password, { encoding: "utf8", mode: 0o600 })
  try {
    const result = run(BINARIES.initdb, [
      "-D",
      metadata.dataDirectory,
      "--username",
      metadata.user,
      "--pwfile",
      passwordFile,
      "--auth-host",
      "scram-sha-256",
      "--auth-local",
      "scram-sha-256",
      "--encoding",
      "UTF8",
    ])
    if (result.status !== 0) fail(`initdb falló: ${redactSecrets(result.stderr || result.stdout)}`)
  } finally {
    fs.rmSync(passwordFile, { force: true })
  }
  appendPostgresConfiguration(metadata.dataDirectory, metadata.port, metadata.cluster)
}

function readPostmasterPid(dataDirectory) {
  const pidFile = path.join(dataDirectory, "postmaster.pid")
  const raw = fs.readFileSync(pidFile, "utf8").split(/\r?\n/, 1)[0]
  if (!/^\d+$/.test(raw)) fail("postmaster.pid no contiene un PID válido")
  return Number(raw)
}

function pgCtlStatus(dataDirectory) {
  return run(BINARIES.pgCtl, ["-D", dataDirectory, "status"], { timeout: 10_000 })
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function startCluster(metadata, password) {
  const result = run(BINARIES.pgCtl, [
    "-D",
    metadata.dataDirectory,
    "-l",
    metadata.postgresLog,
    "start",
  ], { timeout: 30_000, stdio: "ignore" })
  if (result.status !== 0) fail(`pg_ctl no pudo iniciar PostgreSQL: ${redactSecrets(result.stderr || result.stdout)}`)

  let lastError
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      metadata.postgresPid = readPostmasterPid(metadata.dataDirectory)
      writeRunMarker(metadata.root, metadata)
      const launchEnvironment = buildLaunchEnvironment(process.env, metadata, password)
      const verification = await verifyMedusaConnection(launchEnvironment)
      validateClusterIdentity(verification, metadata)
      if (pgCtlStatus(metadata.dataDirectory).status !== 0) {
        fail("pg_ctl no reconoce el directorio de datos iniciado")
      }
      return launchEnvironment
    } catch (error) {
      lastError = error
      await sleep(1_000)
    }
  }
  fail(`PostgreSQL no estuvo listo para verificación: ${redactSecrets(lastError?.message || lastError)}`)
}

function queryResources(launchEnvironment) {
  const query = [
    "SELECT datname",
    "FROM pg_database",
    "WHERE datname IN ('medusa-jovy-http-contacts-rate-limit', 'medusa-jovy-http-contacts-rate-limit-template')",
    "ORDER BY datname",
  ].join(" ")
  const result = run(process.execPath, [
    "-e",
    [
      "const { Client } = require('@medusajs/framework/pg')",
      "const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: 'postgres' })",
      `(async () => { await client.connect(); const result = await client.query(${JSON.stringify(query)}); await client.end(); process.stdout.write(JSON.stringify(result.rows.map((row) => row.datname))); })().catch(async (error) => { await client.end().catch(() => undefined); console.error(error.message); process.exit(1) })`,
    ].join(";"),
  ], { env: launchEnvironment, timeout: 15_000 })
  if (result.status !== 0) fail(`No se pudieron inspeccionar recursos del runner: ${redactSecrets(result.stderr)}`)
  try {
    return JSON.parse(result.stdout)
  } catch {
    fail("Respuesta de inspección de recursos inválida")
  }
}

function stopCluster(metadata) {
  const marker = readOwnedRunMarker(metadata.root, process.env.LOCALAPPDATA, metadata.runId)
  if (marker.postgresPid !== metadata.postgresPid) {
    fail("El PID del marcador no corresponde al PostgreSQL iniciado")
  }
  const result = run(BINARIES.pgCtl, ["-D", metadata.dataDirectory, "-m", "fast", "stop"], { stdio: "ignore" })
  if (result.status !== 0) fail(`pg_ctl no pudo detener PostgreSQL: ${redactSecrets(result.stderr || result.stdout)}`)
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (pgCtlStatus(metadata.dataDirectory).status !== 0) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000)
  }
  fail("PostgreSQL sigue activo después de pg_ctl stop")
}

function saveEvidence(metadata, evidence) {
  const reportsDirectory = path.join(path.dirname(metadata.root), "reports")
  fs.mkdirSync(reportsDirectory, { recursive: true })
  const postgresLog = fs.existsSync(metadata.postgresLog)
    ? redactSecrets(fs.readFileSync(metadata.postgresLog, "utf8"))
    : ""
  const report = {
    ...evidence,
    runId: metadata.runId,
    port: metadata.port,
    user: metadata.user,
    cluster: metadata.cluster,
    dataDirectory: metadata.dataDirectory,
    postgresPid: metadata.postgresPid,
    expectedDatabases: [
      "medusa-jovy-http-contacts-rate-limit",
      "medusa-jovy-http-contacts-rate-limit-template",
    ],
    postgresLog,
  }
  fs.writeFileSync(
    path.join(reportsDirectory, `${metadata.runId}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  )
}

function parseTestCommand(argv) {
  const separator = argv.indexOf("--")
  const command = separator >= 0 ? argv.slice(separator + 1) : []
  if (!command.length) {
    fail("Indique el comando Jest después de --; el launcher no ejecuta suites implícitas")
  }
  return command
}

async function main() {
  assertWindowsPostgres()
  const command = parseTestCommand(process.argv.slice(2))
  const identity = createRunIdentity()
  const root = createRunDirectory(process.env.LOCALAPPDATA, identity.runId)
  const metadata = {
    ...identity,
    root,
    dataDirectory: path.join(root, "data"),
    postgresLog: path.join(root, "postgres.log"),
    port: await findAvailablePort(),
    postgresPid: null,
  }
  const password = createPassword()
  let launchEnvironment
  let jestResult
  let stopped = false

  try {
    writeRunMarker(root, metadata)
    initializeCluster(metadata, password)
    launchEnvironment = await startCluster(metadata, password)
    console.log(`PostgreSQL efímero listo: ejecución ${metadata.runId}, puerto ${metadata.port}, cluster ${metadata.cluster}`)

    jestResult = run(command[0], command.slice(1), {
      env: launchEnvironment,
      timeout: 30 * 60 * 1000,
    })
    const testOutput = redactSecrets(`${jestResult.stdout || ""}${jestResult.stderr || ""}`)
    if (testOutput) process.stdout.write(testOutput)

    const resourcesAfterJest = queryResources(launchEnvironment)
    const passed = jestResult.status === 0
    stopCluster(metadata)
    stopped = true
    saveEvidence(metadata, {
      jest: passed ? "passed" : "failed",
      jestExitCode: jestResult.status,
      runnerResourcesAfterJest: resourcesAfterJest,
      cleanup: passed ? "stopped-and-removed" : "stopped-directory-retained-after-test-failure",
      testOutput,
    })

    if (!passed) {
      writeRunMarker(root, { ...metadata, state: "jest-failed-retained" })
      process.exitCode = jestResult.status || 1
      return
    }

    readOwnedRunMarker(root, process.env.LOCALAPPDATA, metadata.runId)
    fs.rmSync(root, { recursive: true, force: false })
    console.log(`Limpieza correcta: PostgreSQL detenido y directorio efímero eliminado (${metadata.runId})`)
  } catch (error) {
    const message = redactSecrets(error?.stack || error?.message || error)
    console.error(`Launcher PostgreSQL efímero falló: ${message}`)
    try {
      if (metadata.postgresPid && !stopped) {
        stopCluster(metadata)
        stopped = true
      }
      saveEvidence(metadata, {
        jest: jestResult ? "failed" : "not-started",
        jestExitCode: jestResult?.status ?? null,
        cleanup: stopped ? "stopped-directory-retained-after-launcher-failure" : "directory-retained-process-not-confirmed",
        error: message,
      })
    } catch (cleanupError) {
      console.error(`Conservando recursos para inspección: ${redactSecrets(cleanupError?.message || cleanupError)}`)
    }
    process.exitCode = 1
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  BINARIES,
  createPassword,
  findAvailablePort,
  parseTestCommand,
}
