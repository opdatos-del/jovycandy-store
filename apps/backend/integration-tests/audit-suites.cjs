"use strict"

const fs = require("node:fs")
const path = require("node:path")
const backend = path.resolve(__dirname, "..")
const suites = []

function scan(directory) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) scan(file)
    else if (/\.(spec|integration\.test)\.[jt]s$/.test(entry.name)) {
      const source = fs.readFileSync(file, "utf8")
      if (!/\b(medusaIntegrationTestRunner|moduleIntegrationTestRunner)\s*(?:<[^>]*>)?\s*\(/.test(source)) continue
      const dynamic = /\bdbName\s*:\s*integrationDbName\s*\(/.test(source)
      const fixed = /\bdbName\s*:\s*["'`]/.test(source) || /\bconst\s+TEST_DATABASE\s*=\s*["'`]/.test(source)
      suites.push({ file: path.relative(backend, file).replace(/\\/g, "/"), dynamic, fixed })
    }
  }
}

for (const root of ["integration-tests/http", "src/modules"]) scan(path.join(backend, root))
let pending = 0
for (const suite of suites) {
  const ok = suite.dynamic && !suite.fixed
  console.log(`${ok ? "OK" : "PENDING"} ${suite.file}`)
  if (!ok) pending++
}
if (!suites.length) pending++
console.log(`${suites.length} suites detectadas; ${pending} pendientes de auditoría`)
process.exitCode = pending ? 1 : 0
