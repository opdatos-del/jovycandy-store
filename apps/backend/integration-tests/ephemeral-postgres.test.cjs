"use strict"

const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const {
  assertRunRoot,
  createRunDirectory,
  createRunIdentity,
  getRunRoot,
  redactSecrets,
} = require("./ephemeral-postgres.cjs")
const { createPassword, parseTestCommand } = require("./run-ephemeral-postgres.cjs")

test("crea un directorio nuevo y nunca reutiliza una ejecución anterior", (t) => {
  const localAppData = fs.mkdtempSync(path.join(os.tmpdir(), "jovycandy-it-run-"))
  t.after(() => fs.rmSync(localAppData, { recursive: true, force: true }))

  const { runId } = createRunIdentity("3c0c0c0c-1111-4aaa-8bbb-222222222222")
  const root = createRunDirectory(localAppData, runId)
  assert.equal(root, getRunRoot(localAppData, runId))
  assert.doesNotThrow(() => assertRunRoot(root, localAppData, runId))
  assert.throws(() => createRunDirectory(localAppData, runId))
  assert.throws(() => assertRunRoot(path.join(localAppData, "outside"), localAppData, runId))
})

test("exige un comando explícito y no expone secretos al registrar fallos", () => {
  assert.deepEqual(parseTestCommand(["--", "pnpm.cmd", "exec", "jest"]), ["pnpm.cmd", "exec", "jest"])
  assert.throws(() => parseTestCommand([]))

  const password = createPassword()
  assert.match(password, /^[A-Za-z0-9_-]+$/)
  assert.ok(password.length >= 40)
  assert.equal(
    redactSecrets("postgres://runner:super-secret@localhost:45678/postgres DB_PASSWORD=super-secret"),
    "postgres://runner:<redacted>@localhost:45678/postgres DB_PASSWORD=<redacted>",
  )
})
