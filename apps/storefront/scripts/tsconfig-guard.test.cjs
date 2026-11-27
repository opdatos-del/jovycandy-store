"use strict"
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict")
const test = require("node:test")
const { restoreTsconfig } = require("./tsconfig-guard.cjs")

const original = JSON.stringify(
  {
    compilerOptions: { strict: true },
    include: ["next-env.d.ts", "**/*.ts", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  },
  null,
  2,
)

test("restaura el original si Next solo agregó su distDir", () => {
  const current = JSON.stringify(
    {
      compilerOptions: { strict: true },
      include: [
        "next-env.d.ts",
        "**/*.ts",
        ".next/types/**/*.ts",
        ".next/campaign-e2e/types/**/*.ts",
        ".next/campaign-e2e/dev/types/**/*.ts",
      ],
      exclude: ["node_modules"],
    },
    null,
    2,
  )
  assert.deepEqual(restoreTsconfig(original, current, ".next/campaign-e2e"), {
    text: original,
    externalChanges: false,
  })
})

test("conserva cambios ajenos y elimina solo las entradas de campaña", () => {
  const current = JSON.stringify(
    {
      compilerOptions: { strict: true, noUncheckedIndexedAccess: true },
      include: [
        "next-env.d.ts",
        "**/*.ts",
        ".next/campaign-e2e/types/**/*.ts",
      ],
      exclude: ["node_modules", "tmp"],
    },
    null,
    2,
  )
  const result = restoreTsconfig(original, current, ".next/campaign-e2e")
  const parsed = JSON.parse(result.text)
  assert.equal(result.externalChanges, true)
  assert.equal(parsed.compilerOptions.noUncheckedIndexedAccess, true)
  assert.ok(parsed.include.every((entry) => !entry.includes("campaign-e2e")))
  assert.deepEqual(parsed.exclude, ["node_modules", "tmp"])
})

test("falla si el tsconfig actual no es JSON válido", () => {
  assert.throws(() => restoreTsconfig(original, "{ roto", ".next/campaign-e2e"))
})
