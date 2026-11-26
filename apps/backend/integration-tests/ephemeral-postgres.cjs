"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { createHash, randomUUID } = require("node:crypto")

const LOOPBACK_HOST = "localhost"
const IPV4_LOOPBACK = "127.0.0.1"
const FORBIDDEN_PORTS = new Set([5432, 55432])
const RUNS_DIRECTORY = path.join("JovyCandy", "integration-runs")
const MARKER_FILE = "run.json"
const CI_SERVICE_MARKER = "JOVY_CI_POSTGRES_SERVICE"
const CI_SERVICE_DATABASE_MARKER = "JOVY_CI_POSTGRES_DATABASE"
const EPHEMERAL_MARKER = "JOVY_EPHEMERAL_POSTGRES"
const TEST_TYPES = new Set(["unit", "integration:http", "integration:modules"])
const CI_DATABASE_BY_TEST_TYPE = {
  "integration:http": "medusa_ci_http",
  "integration:modules": "medusa_ci_modules",
}
const DATABASE_VARIABLES = [
  "DATABASE_URL",
  "DATABASE_NAME",
  "DB_HOST",
  "DB_PORT",
  "DB_USERNAME",
  "DB_PASSWORD",
  "DB_WAITINGROOM_DATABASE",
  "DB_TEMP_NAME",
  "MEDUSA_DB_SCHEMA",
  "PGSERVICE",
  "PGSERVICEFILE",
  "PGOPTIONS",
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGUSER",
  "PGDATABASE",
  "PGPASSFILE",
  "PGPASSWORD",
  "PGSSLMODE",
  "PGSSLROOTCERT",
  "PGSSLCERT",
  "PGSSLKEY",
  "PGREQUIREAUTH",
]

function normalizePath(value) {
  return path.resolve(value).replace(/\\/g, "/").toLowerCase()
}

function assertRunId(runId) {
  if (
    typeof runId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)
  ) {
    throw new Error("Identificador de ejecución efímera inválido")
  }
}

function createRunIdentity(runId = randomUUID()) {
  assertRunId(runId)
  const compact = runId.replace(/-/g, "").toLowerCase()

  return {
    runId: runId.toLowerCase(),
    cluster: `jovy_it_${compact.slice(0, 20)}`,
    user: `jovy_it_${compact.slice(0, 20)}`,
  }
}

function assertSafePort(port) {
  const numericPort = Number(port)
  if (!Number.isInteger(numericPort) || numericPort < 1025 || numericPort > 65535) {
    throw new Error("Puerto efímero inválido")
  }
  if (FORBIDDEN_PORTS.has(numericPort)) {
    throw new Error("El launcher rechaza los puertos PostgreSQL persistentes")
  }
  return numericPort
}

function getRunRoot(localAppData, runId) {
  assertRunId(runId)
  if (!localAppData) throw new Error("LOCALAPPDATA es obligatorio")
  return path.join(localAppData, RUNS_DIRECTORY, runId.toLowerCase())
}

function assertRunRoot(root, localAppData, runId) {
  const expectedRoot = normalizePath(getRunRoot(localAppData, runId))
  if (normalizePath(root) !== expectedRoot) {
    throw new Error("El directorio de ejecución no pertenece al identificador actual")
  }
  return expectedRoot
}

function createRunDirectory(localAppData, runId) {
  const root = getRunRoot(localAppData, runId)
  const parent = path.dirname(root)
  fs.mkdirSync(parent, { recursive: true })

  try {
    fs.mkdirSync(root)
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw new Error("El launcher no reutiliza directorios de ejecuciones anteriores")
    }
    throw error
  }

  const stat = fs.lstatSync(root)
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("El directorio de ejecución creado no es seguro")
  }
  assertRunRoot(root, localAppData, runId)
  return root
}

function connectionUrl({ user, password, port }) {
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${LOOPBACK_HOST}:${assertSafePort(port)}/postgres`
}

function getMarkerPath(root) {
  return path.join(root, MARKER_FILE)
}

function writeRunMarker(root, metadata) {
  const marker = {
    version: 1,
    state: metadata.state ?? "created",
    runId: metadata.runId,
    root,
    dataDirectory: metadata.dataDirectory,
    port: assertSafePort(metadata.port),
    user: metadata.user,
    cluster: metadata.cluster,
    postgresPid: metadata.postgresPid ?? null,
    createdAt: metadata.createdAt ?? new Date().toISOString(),
  }
  fs.writeFileSync(getMarkerPath(root), `${JSON.stringify(marker, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
  return marker
}

function readOwnedRunMarker(root, localAppData, runId) {
  assertRunRoot(root, localAppData, runId)
  const markerPath = getMarkerPath(root)
  if (!fs.existsSync(markerPath)) throw new Error("Falta marcador de propiedad de la ejecución")

  let marker
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, "utf8"))
  } catch {
    throw new Error("Marcador de ejecución inválido")
  }

  const identity = createRunIdentity(runId)
  if (
    marker.version !== 1 ||
    marker.runId !== identity.runId ||
    marker.user !== identity.user ||
    marker.cluster !== identity.cluster ||
    normalizePath(marker.root) !== normalizePath(root) ||
    normalizePath(marker.dataDirectory) !== normalizePath(path.join(root, "data")) ||
    assertSafePort(marker.port) !== Number(marker.port)
  ) {
    throw new Error("Marcador de ejecución no corresponde al cluster solicitado")
  }
  return marker
}

function buildLaunchEnvironment(baseEnv, metadata, password) {
  const environment = { ...baseEnv }
  for (const key of DATABASE_VARIABLES) delete environment[key]
  for (const key of Object.keys(environment)) {
    if (key.startsWith("PG") || key.startsWith("DB_")) delete environment[key]
  }

  const port = assertSafePort(metadata.port)
  Object.assign(environment, {
    [EPHEMERAL_MARKER]: "1",
    JOVY_EPHEMERAL_POSTGRES_RUN_ID: metadata.runId,
    JOVY_EPHEMERAL_POSTGRES_ROOT: metadata.root,
    JOVY_EPHEMERAL_POSTGRES_DATA_DIRECTORY: metadata.dataDirectory,
    JOVY_EPHEMERAL_POSTGRES_PORT: String(port),
    JOVY_EPHEMERAL_POSTGRES_USER: metadata.user,
    JOVY_EPHEMERAL_POSTGRES_CLUSTER: metadata.cluster,
    JOVY_EPHEMERAL_POSTGRES_PID: String(metadata.postgresPid),
    DB_HOST: LOOPBACK_HOST,
    DB_PORT: String(port),
    DB_USERNAME: metadata.user,
    DB_PASSWORD: password,
    DB_WAITINGROOM_DATABASE: "postgres",
    DATABASE_URL: connectionUrl({ user: metadata.user, password, port }),
  })
  return environment
}

function validateEnvironment(env, expected) {
  if (!expected) throw new Error("Falta identidad esperada del cluster efímero")
  const port = assertSafePort(expected.port)
  const identity = createRunIdentity(expected.runId)
  const expectedRoot = assertRunRoot(expected.root, env.LOCALAPPDATA, expected.runId)
  const expectedDataDirectory = normalizePath(expected.dataDirectory)
  if (expectedDataDirectory !== normalizePath(path.join(expected.root, "data"))) {
    throw new Error("Directorio de datos efímero inválido")
  }

  const required = {
    [EPHEMERAL_MARKER]: "1",
    JOVY_EPHEMERAL_POSTGRES_RUN_ID: identity.runId,
    JOVY_EPHEMERAL_POSTGRES_ROOT: expected.root,
    JOVY_EPHEMERAL_POSTGRES_DATA_DIRECTORY: expected.dataDirectory,
    JOVY_EPHEMERAL_POSTGRES_PORT: String(port),
    JOVY_EPHEMERAL_POSTGRES_USER: identity.user,
    JOVY_EPHEMERAL_POSTGRES_CLUSTER: identity.cluster,
    DB_HOST: LOOPBACK_HOST,
    DB_PORT: String(port),
    DB_USERNAME: identity.user,
    DB_WAITINGROOM_DATABASE: "postgres",
  }
  for (const [key, value] of Object.entries(required)) {
    if (env[key] !== value) throw new Error(`${key} no corresponde al cluster efímero`)
  }
  if (!env.DB_PASSWORD) throw new Error("Falta credencial temporal de PostgreSQL")
  if (!/^\d+$/.test(env.JOVY_EPHEMERAL_POSTGRES_PID ?? "")) {
    throw new Error("Falta identificador de proceso PostgreSQL")
  }
  for (const key of Object.keys(env)) {
    if (key.startsWith("PG")) throw new Error(`${key} no está permitido durante integración local`)
    if (key.startsWith("DB_") && key !== "DB_PASSWORD" && !(key in required)) {
      throw new Error(`${key} no está permitido durante integración local`)
    }
  }

  let url
  try {
    url = new URL(env.DATABASE_URL)
  } catch {
    throw new Error("DATABASE_URL efímera inválida")
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== LOOPBACK_HOST ||
    url.port !== String(port) ||
    decodeURIComponent(url.username) !== identity.user ||
    decodeURIComponent(url.password) !== env.DB_PASSWORD ||
    url.pathname !== "/postgres" ||
    url.search ||
    url.hash
  ) {
    throw new Error("DATABASE_URL no corresponde al cluster efímero")
  }

  return {
    runId: identity.runId,
    root: expectedRoot,
    dataDirectory: expectedDataDirectory,
    port,
    user: identity.user,
    cluster: identity.cluster,
    postgresPid: Number(env.JOVY_EPHEMERAL_POSTGRES_PID),
  }
}

function environmentFromMarker(env = process.env) {
  const runId = env.JOVY_EPHEMERAL_POSTGRES_RUN_ID
  const root = env.JOVY_EPHEMERAL_POSTGRES_ROOT
  if (!runId || !root) throw new Error("Falta contexto del launcher PostgreSQL efímero")
  const marker = readOwnedRunMarker(root, env.LOCALAPPDATA, runId)
  return {
    ...marker,
    root,
    dataDirectory: marker.dataDirectory,
    port: marker.port,
  }
}

function assertTestType(value) {
  if (!TEST_TYPES.has(value)) {
    throw new Error(
      "TEST_TYPE debe ser unit, integration:http o integration:modules; Jest no ejecuta una configuración implícita",
    )
  }
  return value
}

function validateCiServiceEnvironment(env = process.env, { platform = process.platform } = {}) {
  const testType = assertTestType(env.TEST_TYPE)
  const expectedDatabase = CI_DATABASE_BY_TEST_TYPE[testType]
  if (!expectedDatabase) {
    throw new Error("El servicio PostgreSQL CI solo admite suites de integración")
  }
  if (
    env[CI_SERVICE_MARKER] !== "1" ||
    env.CI !== "true" ||
    platform === "win32"
  ) {
    throw new Error("El servicio PostgreSQL CI no está autorizado")
  }
  if (
    env[CI_SERVICE_DATABASE_MARKER] !== expectedDatabase ||
    env.DB_HOST !== LOOPBACK_HOST ||
    env.DB_PORT !== "5432" ||
    env.DB_USERNAME !== "postgres" ||
    env.DB_PASSWORD !== "postgres"
  ) {
    throw new Error("Las variables del servicio PostgreSQL CI no corresponden a la suite")
  }

  let url
  try {
    url = new URL(env.DATABASE_URL)
  } catch {
    throw new Error("DATABASE_URL del servicio PostgreSQL CI es inválida")
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== LOOPBACK_HOST ||
    url.port !== "5432" ||
    decodeURIComponent(url.username) !== "postgres" ||
    decodeURIComponent(url.password) !== "postgres" ||
    url.pathname !== `/${expectedDatabase}` ||
    url.search ||
    url.hash
  ) {
    throw new Error("DATABASE_URL del servicio PostgreSQL CI no corresponde a la suite")
  }

  return { mode: "ci-service", database: expectedDatabase, port: 5432, user: "postgres" }
}

function assertLocalIntegrationEnvironment(env = process.env, options = {}) {
  if (env[EPHEMERAL_MARKER] === "1") {
    return validateEnvironment(env, environmentFromMarker(env))
  }
  if (env[CI_SERVICE_MARKER] === "1") return validateCiServiceEnvironment(env, options)
  throw new Error(
    "Las pruebas de integración locales requieren el launcher PostgreSQL efímero. Use test:integration:http:ephemeral -- <suite>.",
  )
}

function validateClusterIdentity(server, expected) {
  const actual = {
    user: server.user,
    host: server.host,
    port: Number(server.port),
    directory: normalizePath(server.directory),
    cluster: server.cluster,
  }
  const expectedIdentity = {
    user: expected.user,
    host: IPV4_LOOPBACK,
    port: Number(expected.port),
    directory: normalizePath(expected.dataDirectory),
    cluster: expected.cluster,
  }
  if (JSON.stringify(actual) !== JSON.stringify(expectedIdentity)) {
    throw new Error(`La identidad del servidor PostgreSQL no coincide: ${JSON.stringify({ actual, expected: expectedIdentity })}`)
  }
}

function suiteDatabaseName(runId, suite) {
  assertRunId(runId)
  if (typeof suite !== "string" || !suite || suite.includes("..") || suite.includes("\\") || suite.startsWith("/")) {
    throw new Error("Nombre de suite inválido")
  }
  const hash = createHash("sha256").update(suite).digest("hex").slice(0, 12)
  return `jovy_it_${runId.replace(/-/g, "").slice(0, 12)}_${hash}`
}

function redactSecrets(value) {
  return String(value)
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1<redacted>@")
    .replace(/(DB_PASSWORD=)[^\s\r\n]+/gi, "$1<redacted>")
    .replace(/(PGPASSWORD=)[^\s\r\n]+/gi, "$1<redacted>")
}

module.exports = {
  CI_DATABASE_BY_TEST_TYPE,
  CI_SERVICE_DATABASE_MARKER,
  CI_SERVICE_MARKER,
  DATABASE_VARIABLES,
  EPHEMERAL_MARKER,
  FORBIDDEN_PORTS,
  IPV4_LOOPBACK,
  LOOPBACK_HOST,
  assertLocalIntegrationEnvironment,
  assertRunId,
  assertRunRoot,
  assertSafePort,
  assertTestType,
  buildLaunchEnvironment,
  connectionUrl,
  createRunDirectory,
  createRunIdentity,
  environmentFromMarker,
  getRunRoot,
  readOwnedRunMarker,
  redactSecrets,
  suiteDatabaseName,
  validateClusterIdentity,
  validateCiServiceEnvironment,
  validateEnvironment,
  writeRunMarker,
}
