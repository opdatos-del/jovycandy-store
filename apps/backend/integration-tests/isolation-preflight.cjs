const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { createHash } = require("node:crypto")

const HOST = "127.0.0.1"
const PORT = "55432"
const USER = "jovy_test"
const CLUSTER = "jovy_disposable_f002598ccccd4f44b0f0a066e00fe7ad"
const ROOT_NAME = "integration-postgres-f002598ccccd4f44b0f0a066e00fe7ad"

function suiteDatabaseName(runId, suite) {
  if (!/^[0-9a-f]{12}$/.test(runId) || typeof suite !== "string" || !suite || suite.includes("..") || suite.startsWith("/") || suite.includes("\\")) {
    throw new Error("Identidad de ejecución o suite inválida")
  }
  const hash = createHash("sha256").update(suite).digest("hex").slice(0, 12)
  return `jovy_it_${runId}_${hash}`
}

function validateEnvironment(env) {
  for (const [key, expected] of Object.entries({ DB_HOST: HOST, DB_PORT: PORT, DB_USERNAME: USER })) {
    if (env[key] && env[key] !== expected) throw new Error(`${key} no corresponde al cluster aislado`)
  }
  for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGOPTIONS", "PGHOSTADDR", "PGDATABASE", "DATABASE_NAME", "PGPASSFILE", "PGSSLMODE", "PGSSLROOTCERT", "PGSSLCERT", "PGSSLKEY", "PGREQUIREAUTH"]) {
    if (env[key]) throw new Error(`${key} no autorizado`)
  }
  for (const [key, expected] of Object.entries({ PGHOST: HOST, PGPORT: PORT, PGUSER: USER })) {
    if (env[key] && env[key] !== expected) throw new Error(`${key} no corresponde al cluster aislado`)
  }
  if (env.DB_WAITINGROOM_DATABASE && env.DB_WAITINGROOM_DATABASE !== "postgres") {
    throw new Error("DB_WAITINGROOM_DATABASE no autorizado")
  }
  if (env.DATABASE_URL) {
    let url
    try { url = new URL(env.DATABASE_URL) } catch { throw new Error("DATABASE_URL inválida") }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== HOST || url.port !== PORT || decodeURIComponent(url.username) !== USER || url.pathname !== "/postgres" || url.search || url.hash) {
      throw new Error("DATABASE_URL no corresponde al cluster aislado")
    }
  }
}

function validateServer(server, expectedDirectory) {
  if (server.user !== USER || server.host !== HOST || String(server.port) !== PORT || String(server.directory).replace(/\\/g, "/").toLowerCase() !== expectedDirectory || server.cluster !== CLUSTER) {
    throw new Error("La identidad del servidor PostgreSQL no coincide")
  }
}

function preflight(env = process.env) {
  validateEnvironment(env)
  if (process.platform !== "win32" || !env.LOCALAPPDATA) throw new Error("Entorno local no compatible")
  const root = path.join(env.LOCALAPPDATA, "JovyCandy", ROOT_NAME)
  const expectedDirectory = path.resolve(root, "data").replace(/\\/g, "/").toLowerCase()
  const password = fs.readFileSync(path.join(root, "password.txt"), "utf8").trim()
  if (!password || (env.DB_PASSWORD && env.DB_PASSWORD !== password) || (env.PGPASSWORD && env.PGPASSWORD !== password)) throw new Error("Credenciales de pruebas inválidas")
  if (env.DATABASE_URL && decodeURIComponent(new URL(env.DATABASE_URL).password) !== password) throw new Error("Credenciales de DATABASE_URL no coinciden")
  const psql = path.join(env.ProgramFiles || "C:\\Program Files", "PostgreSQL", "18", "bin", "psql.exe")
  const sql = "SELECT json_build_object('user',current_user,'host',host(inet_server_addr()),'port',inet_server_port(),'directory',current_setting('data_directory'),'cluster',current_setting('cluster_name'))::text"
  const result = spawnSync(psql, ["-X", "-A", "-t", "-w", "-v", "ON_ERROR_STOP=1", "-h", HOST, "-p", PORT, "-U", USER, "-d", "postgres", "-c", sql], {
    encoding: "utf8", timeout: 10000, windowsHide: true,
    env: { SystemRoot: env.SystemRoot, PATH: env.PATH, PGPASSWORD: password, PGCONNECT_TIMEOUT: "5", PGSSLMODE: "disable" },
  })
  if (result.error || result.status !== 0) throw new Error("No se pudo verificar PostgreSQL aislado")
  let server
  try { server = JSON.parse(result.stdout.trim()) } catch { throw new Error("Respuesta de identidad inválida") }
  validateServer(server, expectedDirectory)
  return { host: HOST, port: Number(PORT), user: USER, directory: server.directory, cluster: CLUSTER }
}

module.exports = { suiteDatabaseName, validateEnvironment, validateServer, preflight }
if (require.main === module) {
  try { console.log(JSON.stringify(preflight())) } catch (error) { console.error(`Preflight rechazado: ${error.message}`); process.exitCode = 1 }
}
