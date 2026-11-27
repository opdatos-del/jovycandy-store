"use strict"
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const { finalizeCampaignRun } = require("./campaign-e2e-cleanup.cjs")

function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jovy-campaign-cleanup-"))
  fs.writeFileSync(path.join(root, "marker.txt"), "run")
  return root
}

test("Playwright pasa pero stopCluster falla: ejecución fallida y raíz conservada", async () => {
  const root = temporaryRoot()
  const reports = []

  const result = await finalizeCampaignRun({
    playwrightPassed: true,
    root,
    steps: [
      { name: "backend", run: async () => ({ stopped: true }) },
      { name: "storefront", run: async () => ({ stopped: true }) },
      {
        name: "postgres",
        run: async () => {
          throw new Error("pg_ctl no pudo detener PostgreSQL")
        },
      },
    ],
    evidence: { runId: "run-1" },
    saveEvidence: async (evidence) => reports.push(evidence),
    updateEvidence: async (evidence) => reports.push(evidence),
  })

  assert.equal(result.overall, false)
  assert.equal(result.cleanupPassed, false)
  assert.equal(result.rootRemoved, false)
  assert.equal(result.evidence.cleanup, "failed")
  assert.equal(result.evidence.overall, "failed")
  assert.equal(result.evidence.postgres.ok, false)
  assert.ok(fs.existsSync(path.join(root, "marker.txt")))
  assert.ok(reports.some((report) => report.cleanup === "failed"))
  fs.rmSync(root, { recursive: true, force: true })
})

test("Playwright y limpieza correctos: raíz eliminada y evidencia final", async () => {
  const root = temporaryRoot()
  const reports = []

  const result = await finalizeCampaignRun({
    playwrightPassed: true,
    root,
    steps: [
      { name: "backend", run: async () => ({ stopped: true }) },
      { name: "storefront", run: async () => ({ stopped: true }) },
      { name: "postgres", run: async () => ({ stopped: true }) },
    ],
    evidence: { runId: "run-2" },
    saveEvidence: async (evidence) => reports.push(evidence),
    updateEvidence: async (evidence) => reports.push(evidence),
  })

  assert.equal(result.overall, true)
  assert.equal(result.cleanupPassed, true)
  assert.equal(result.rootRemoved, true)
  assert.equal(fs.existsSync(root), false)
  assert.equal(result.evidence.cleanup, "passed")
  assert.equal(result.evidence.overall, "passed")
  assert.equal(result.evidence.rootRemoved, true)
})

test("Playwright falla pero la limpieza termina: no se declara éxito ni se borra la raíz", async () => {
  const root = temporaryRoot()

  const result = await finalizeCampaignRun({
    playwrightPassed: false,
    root,
    steps: [{ name: "postgres", run: async () => ({ stopped: true }) }],
    evidence: { runId: "run-3" },
    saveEvidence: async () => undefined,
    updateEvidence: async () => undefined,
  })

  assert.equal(result.overall, false)
  assert.equal(result.cleanupPassed, true)
  assert.equal(result.rootRemoved, false)
  assert.equal(result.evidence.playwright, "failed")
  assert.equal(result.evidence.overall, "failed")
  assert.ok(fs.existsSync(root))
  fs.rmSync(root, { recursive: true, force: true })
})

test("Si no se puede guardar evidencia, no se declara éxito ni se elimina la raíz", async () => {
  const root = temporaryRoot()

  const result = await finalizeCampaignRun({
    playwrightPassed: true,
    root,
    steps: [{ name: "postgres", run: async () => ({ stopped: true }) }],
    evidence: { runId: "run-4" },
    saveEvidence: async () => {
      throw new Error("disco lleno")
    },
    updateEvidence: async () => undefined,
  })

  assert.equal(result.overall, false)
  assert.equal(result.cleanupPassed, false)
  assert.equal(result.rootRemoved, false)
  assert.ok(fs.existsSync(root))
  fs.rmSync(root, { recursive: true, force: true })
})
