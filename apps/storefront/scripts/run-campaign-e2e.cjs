"use strict"
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * E2E aislado de campañas comerciales.
 *
 * Levanta un PostgreSQL efímero con el launcher ya validado, migra una base
 * nueva, siembra catálogo e infraestructura de laboratorio, inicia backend y
 * storefront en puertos aleatorios y ejecuta Playwright. No toca 5432, 55432 ni
 * la base de desarrollo.
 */

const fs = require("node:fs")
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

const STOREFRONT_DIRECTORY = path.resolve(__dirname, "..")
const BACKEND_DIRECTORY = path.resolve(STOREFRONT_DIRECTORY, "..", "backend")
const REPORT_PREFIX = "e2e-campaign"

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

function extractMarker(output) {
  const clean = String(output).replace(/\u001b\[[0-9;]*m/g, "")
  const match = clean.match(/JOVY_E2E_SEED (\{.*\})/)
  if (!match) {
    throw new Error(`El seed E2E no devolvió su marcador. Salida: ${redact(clean).slice(-4_000)}`)
  }
  return JSON.parse(match[1])
}

async function main() {
  const tsconfigPath = path.join(STOREFRONT_DIRECTORY, "tsconfig.json")
  const originalTsconfig = fs.readFileSync(tsconfigPath, "utf8")
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
  const database = `jovy_e2e_${identity.runId.replace(/-/g, "").slice(0, 20)}`
  let launchEnvironment
  let backendProcess
  let storefrontProcess
  let stopped = false
  let passed = false
  let testOutput = ""
  let errorMessage = ""
  let marker
  let nextDistDirectory = ""

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
    await waitForUrl(`http://127.0.0.1:${backendPort}/health`, 180_000, "backend")

    const nextDistDir = ".next/campaign-e2e"
    nextDistDirectory = path.join(STOREFRONT_DIRECTORY, nextDistDir)
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
    await waitForUrl(
      `http://localhost:${storefrontPort}/es/catalogo`,
      240_000,
      "storefront",
    )

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
    passed = playwright.status === 0
    if (!passed) errorMessage = `Playwright terminó con código ${playwright.status}`
  } catch (error) {
    errorMessage = redact(error instanceof Error ? error.stack || error.message : String(error))
    console.error(`[e2e-campaign] ${errorMessage}`)
  } finally {
    killTree(storefrontProcess)
    killTree(backendProcess)
    if (nextDistDirectory) {
      fs.rmSync(nextDistDirectory, { recursive: true, force: true })
    }
    // `next dev` agrega el distDir a tsconfig; se restaura el archivo original.
    fs.writeFileSync(tsconfigPath, originalTsconfig, "utf8")
    process.stdout.write(`\n[e2e-campaign] cleanup\n`)
    try {
      if (metadata.postgresPid && !stopped) {
        stopCluster(metadata)
        stopped = true
      }
    } catch (error) {
      console.error(`[e2e-campaign] no se pudo detener PostgreSQL: ${redact(error)}`)
    }
    try {
      saveEvidence(metadata, {
        suite: REPORT_PREFIX,
        jest: passed ? "passed" : "failed",
        jestExitCode: passed ? 0 : 1,
        cleanup: passed ? "stopped-and-removed" : "stopped-directory-retained-after-e2e-failure",
        error: errorMessage,
        testOutput,
        database,
        productHandle: marker?.product?.handle ?? null,
      })
    } catch (error) {
      console.error(`[e2e-campaign] no se pudo guardar evidencia: ${redact(error)}`)
    }
    if (passed) {
      fs.rmSync(root, { recursive: true, force: false })
      console.log(`[e2e-campaign] evidencia y limpieza correctas (${metadata.runId})`)
    } else {
      process.exitCode = 1
      console.error(`[e2e-campaign] recursos conservados para inspección (${metadata.runId})`)
    }
  }

  if (!passed && !process.exitCode) process.exitCode = 1
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.stack || error.message : String(error)))
  process.exitCode = 1
})
