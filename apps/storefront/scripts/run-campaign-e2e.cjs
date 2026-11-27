"use strict"
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * E2E aislado de campañas comerciales.
 *
 * Levanta un PostgreSQL efímero con el launcher ya validado, migra una base
 * nueva, siembra catálogo e infraestructura de laboratorio, inicia backend y
 * storefront en puertos aleatorios y ejecuta Playwright. No toca 5432, 55432 ni
 * la base de desarrollo.
 *
 * La limpieza se reporta por separado del resultado de Playwright. Un fallo al
 * detener PostgreSQL, backend o storefront marca la ejecución como fallida y
 * conserva el directorio para inspección.
 */

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { randomBytes } = require("node:crypto")
const { spawn, spawnSync } = require("node:child_process")
const {
  createPassword,
  findAvailablePort,
  initializeCluster,
  saveEvidence,
  startCluster,
  stopCluster,
} = require("../../backend/integration-tests/run-ephemeral-postgres.cjs")
const {
  createRunDirectory,
  createRunIdentity,
  writeRunMarker,
} = require("../../backend/integration-tests/ephemeral-postgres.cjs")
const { restoreTsconfig } = require("./tsconfig-guard.cjs")
const { finalizeCampaignRun } = require("./campaign-e2e-cleanup.cjs")

const STOREFRONT_DIRECTORY = path.resolve(__dirname, "..")
const BACKEND_DIRECTORY = path.resolve(STOREFRONT_DIRECTORY, "..", "backend")
const REPORT_PREFIX = "e2e-campaign"
const LOCK_PATH = path.join(
  process.env.LOCALAPPDATA ?? os.tmpdir(),
  "JovyCandy",
  "campaign-e2e.lock",
)

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function redact(value) {
  return String(value)
    .replace(/postgres:\/\/[^@\s]+@/g, "postgres://<redacted>@")
    .replace(/(password|secret|token)=\S+/gi, "$1=<redacted>")
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeout ?? 120_000,
    windowsHide: true,
    shell: options.shell ?? process.platform === "win32",
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.error) throw result.error
  return result
}

function runChecked(command, args, options = {}) {
  const result = run(command, args, options)
  if (result.status !== 0) {
    throw new Error(
      `${command} falló (${result.status}): ${redact(
        (result.stderr || "") + (result.stdout || ""),
      ).slice(-4_000)}`,
    )
  }
  return result
}

function acquireLock(lockPath, runId) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })
  try {
    const descriptor = fs.openSync(lockPath, "wx")
    try {
      fs.writeFileSync(
        descriptor,
        `${JSON.stringify({ runId, pid: process.pid, createdAt: new Date().toISOString() })}\n`,
        "utf8",
      )
    } finally {
      fs.closeSync(descriptor)
    }
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw new Error(
        "Ya hay otra ejecución E2E de campañas activa. Elimina .next/campaign-e2e.lock solo si estás seguro de que no hay un proceso en curso.",
      )
    }
    throw error
  }
}

function releaseLock(lockPath) {
  fs.rmSync(lockPath, { force: true })
}

function databaseUrl(launchEnvironment, database) {
  const url = new URL(launchEnvironment.DATABASE_URL)
  url.pathname = `/${database}`
  return url.toString()
}

function createDatabase(launchEnvironment, database) {
  const script = [
    "const { Client } = require('@medusajs/framework/pg');",
    "const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: 'postgres' });",
    "(async () => {",
    "  await client.connect();",
    `  await client.query('CREATE DATABASE "${database}"');`,
    "  await client.end();",
    "})().catch(async (error) => { await client.end().catch(() => undefined); console.error(error.message); process.exit(1); });",
  ].join("\n")

  const result = runChecked(process.execPath, ["-e", script], {
    cwd: BACKEND_DIRECTORY,
    env: launchEnvironment,
    timeout: 30_000,
    shell: false,
  })
  if (result.stdout) process.stdout.write(result.stdout)
}

async function waitForUrl(url, timeoutMs, label) {
  const started = Date.now()
  let lastError = ""
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" })
      if (response.status < 500) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await sleep(1_000)
  }
  throw new Error(`${label} no respondió en ${timeoutMs} ms: ${lastError}`)
}

async function isUrlClosed(url) {
  try {
    await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(1_000) })
    return false
  } catch {
    return true
  }
}

function startProcess(command, args, options) {
  const stdout = fs.createWriteStream(options.logFile, { flags: "a" })
  const stderr = fs.createWriteStream(options.logFile, { flags: "a" })
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    windowsHide: true,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  })
  child.stdout.pipe(stdout)
  child.stderr.pipe(stderr)
  return child
}

function killTree(child) {
  if (!child || !child.pid) return
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    })
    return
  }
  try {
    process.kill(-child.pid, "SIGTERM")
  } catch {
    try {
      process.kill(child.pid, "SIGTERM")
    } catch {
      // El proceso ya terminó.
    }
  }
}

function isProcessAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function stopChild(child, { name, url }) {
  if (!child || !child.pid) return { stopped: true, pid: null }
  killTree(child)
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const alive = isProcessAlive(child.pid)
    const closed = await isUrlClosed(url)
    if (!alive && closed) return { stopped: true, pid: child.pid }
    await sleep(500)
  }
  throw new Error(`${name} sigue activo después de la limpieza`)
}

function extractMarker(output) {
  const clean = String(output).replace(/\u001b\[[0-9;]*m/g, "")
  const match = clean.match(/JOVY_E2E_SEED (\{.*\})/)
  if (!match) {
    throw new Error(`El seed E2E no devolvió su marcador. Salida: ${redact(clean).slice(-4_000)}`)
  }
  return JSON.parse(match[1])
}

async function main() {
  const identity = createRunIdentity()
  try {
    acquireLock(LOCK_PATH, identity.runId)
  } catch (error) {
    console.error(`[e2e-campaign] ${redact(error)}`)
    process.exitCode = 1
    return
  }

  const tsconfigPath = path.join(STOREFRONT_DIRECTORY, "tsconfig.json")
  const originalTsconfig = fs.readFileSync(tsconfigPath, "utf8")
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
  const database = `jovy_e2e_${identity.runId.replace(/-/g, "").slice(0, 20)}`
  const nextDistDir = `.next/campaign-${identity.runId}`
  const nextDistDirectory = path.join(STOREFRONT_DIRECTORY, nextDistDir)
  const reportPath = path.join(path.dirname(root), "reports", `${identity.runId}.json`)
  let launchEnvironment
  let backendProcess
  let storefrontProcess
  let backendUrl = ""
  let storefrontUrl = ""
  let playwrightPassed = false
  let testOutput = ""
  let errorMessage = ""
  let marker

  try {
    writeRunMarker(root, metadata)
    initializeCluster(metadata, password)
    launchEnvironment = await startCluster(metadata, password)
    createDatabase(launchEnvironment, database)

    const databaseEnvironment = {
      ...launchEnvironment,
      DATABASE_URL: databaseUrl(launchEnvironment, database),
      DATABASE_NAME: database,
      NODE_ENV: "development",
      DEPLOYMENT_ENV: "development",
    }

    console.log(`[e2e-campaign] PostgreSQL efímero ${metadata.runId} en ${metadata.port}`)

    runChecked("pnpm", ["exec", "medusa", "db:migrate"], {
      cwd: BACKEND_DIRECTORY,
      env: databaseEnvironment,
      timeout: 10 * 60 * 1_000,
    })

    const adminEmail = `e2e-${identity.runId.slice(0, 8)}@jovy.test`
    const adminPassword = `E2E-${randomBytes(18).toString("base64url")}`
    const seed = runChecked(
      "pnpm",
      ["exec", "medusa", "exec", "./src/scripts/seed-campaign-e2e.ts"],
      {
        cwd: BACKEND_DIRECTORY,
        env: {
          ...databaseEnvironment,
          JOVY_E2E_ADMIN_EMAIL: adminEmail,
          JOVY_E2E_ADMIN_PASSWORD: adminPassword,
        },
        timeout: 10 * 60 * 1_000,
      },
    )
    marker = extractMarker(`${seed.stdout}\n${seed.stderr}`)
    console.log(`[e2e-campaign] catálogo sembrado: ${marker.product.handle}`)

    const backendPort = await findAvailablePort()
    const storefrontPort = await findAvailablePort()
    const serviceUrls = [
      `http://127.0.0.1:${storefrontPort}`,
      `http://localhost:${storefrontPort}`,
    ]
    backendUrl = `http://127.0.0.1:${backendPort}/health`
    storefrontUrl = `http://localhost:${storefrontPort}/es/catalogo`

    backendProcess = startProcess("pnpm", ["exec", "medusa", "develop"], {
      cwd: BACKEND_DIRECTORY,
      logFile: path.join(root, "backend.log"),
      env: {
        ...databaseEnvironment,
        PORT: String(backendPort),
        FILE_BACKEND_URL: `http://127.0.0.1:${backendPort}/static`,
        STORE_CORS: serviceUrls.join(","),
        ADMIN_CORS: serviceUrls.join(","),
        AUTH_CORS: serviceUrls.join(","),
        JWT_SECRET: randomBytes(48).toString("base64url"),
        COOKIE_SECRET: randomBytes(48).toString("base64url"),
        JOVY_REVALIDATION_ENABLED: "false",
      },
    })
    await waitForUrl(backendUrl, 180_000, "backend")

    storefrontProcess = startProcess(
      "pnpm",
      ["exec", "next", "dev", "-p", String(storefrontPort)],
      {
        cwd: STOREFRONT_DIRECTORY,
        logFile: path.join(root, "storefront.log"),
        env: {
          ...process.env,
          NODE_ENV: "development",
          NEXT_TELEMETRY_DISABLED: "1",
          JOVY_NEXT_DIST_DIR: nextDistDir,
          MEDUSA_BACKEND_URL: `http://127.0.0.1:${backendPort}`,
          MEDUSA_PUBLISHABLE_API_KEY: marker.publishableKey,
          NEXT_PUBLIC_MEDUSA_BACKEND_URL: `http://127.0.0.1:${backendPort}`,
          NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY: marker.publishableKey,
          NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${storefrontPort}`,
        },
      },
    )
    await waitForUrl(storefrontUrl, 240_000, "storefront")

    const playwright = run(
      "pnpm",
      ["exec", "playwright", "test", "--config=playwright.campaign.config.ts", "--reporter=line"],
      {
        cwd: STOREFRONT_DIRECTORY,
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: `http://localhost:${storefrontPort}`,
          E2E_BACKEND_URL: `http://127.0.0.1:${backendPort}`,
          E2E_ADMIN_EMAIL: marker.email,
          E2E_ADMIN_PASSWORD: marker.password,
          E2E_PRODUCT_HANDLE: marker.product.handle,
          E2E_PRODUCT_TITLE: marker.product.title,
          E2E_PRODUCT_VARIANT_ID: marker.product.variantId,
          E2E_PRODUCT_BASE_AMOUNT: String(marker.product.baseAmount),
        },
        timeout: 20 * 60 * 1_000,
      },
    )
    testOutput = redact(`${playwright.stdout || ""}${playwright.stderr || ""}`)
    if (testOutput) process.stdout.write(testOutput)
    playwrightPassed = playwright.status === 0
    if (!playwrightPassed) errorMessage = `Playwright terminó con código ${playwright.status}`
  } catch (error) {
    errorMessage = redact(error instanceof Error ? error.stack || error.message : String(error))
    console.error(`[e2e-campaign] ${errorMessage}`)
  } finally {
    const result = await finalizeCampaignRun({
      playwrightPassed,
      root,
      steps: [
        {
          name: "storefront",
          run: () =>
            stopChild(storefrontProcess, {
              name: "storefront",
              url: storefrontUrl || "http://localhost:1",
            }),
        },
        {
          name: "backend",
          run: () =>
            stopChild(backendProcess, {
              name: "backend",
              url: backendUrl || "http://127.0.0.1:1",
            }),
        },
        {
          name: "tsconfig",
          run: () => {
            const currentTsconfig = fs.readFileSync(tsconfigPath, "utf8")
            const restored = restoreTsconfig(
              originalTsconfig,
              currentTsconfig,
              nextDistDir,
            )
            fs.writeFileSync(tsconfigPath, restored.text, "utf8")
            if (restored.externalChanges) {
              console.warn(
                "[e2e-campaign] se conservaron cambios externos en tsconfig.json",
              )
            }
            return { restored: true, externalChanges: restored.externalChanges }
          },
        },
        {
          name: "distDir",
          run: () => {
            fs.rmSync(nextDistDirectory, { recursive: true, force: true })
            if (fs.existsSync(nextDistDirectory)) {
              throw new Error("El distDir temporal sigue existiendo.")
            }
            return { removed: true }
          },
        },
        {
          name: "postgres",
          run: () => {
            if (!metadata.postgresPid) return { stopped: false, skipped: true }
            stopCluster(metadata)
            return { stopped: true, verifiedByPgCtl: true }
          },
        },
      ],
      evidence: {
        suite: REPORT_PREFIX,
        database,
        productHandle: marker?.product?.handle ?? null,
        error: errorMessage,
        testOutput,
      },
      saveEvidence: async (report) => saveEvidence(metadata, report),
      updateEvidence: async (report) => {
        if (!fs.existsSync(reportPath)) return
        const current = JSON.parse(fs.readFileSync(reportPath, "utf8"))
        fs.writeFileSync(
          reportPath,
          `${JSON.stringify({ ...current, ...report, postgresLog: current.postgresLog }, null, 2)}\n`,
          { encoding: "utf8", mode: 0o600 },
        )
      },
    })

    if (result.overall) {
      console.log(
        `[e2e-campaign] Playwright y limpieza verificados; directorio eliminado (${metadata.runId})`,
      )
    } else {
      const cleanup = result.cleanupPassed ? "limpio" : "falló"
      console.error(
        `[e2e-campaign] ejecución fallida (Playwright ${playwrightPassed ? "ok" : "falló"}, limpieza ${cleanup}). Recursos conservados (${metadata.runId})`,
      )
      if (result.cleanupErrors.length) {
        console.error(
          `[e2e-campaign] errores de limpieza: ${JSON.stringify(result.cleanupErrors)}`,
        )
      }
      process.exitCode = 1
    }

    releaseLock(LOCK_PATH)
  }
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.stack || error.message : String(error)))
  try {
    releaseLock(LOCK_PATH)
  } catch {
    // Sin lock previo.
  }
  process.exitCode = 1
})
