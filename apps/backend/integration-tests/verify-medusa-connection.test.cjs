const test = require("node:test")
const assert = require("node:assert/strict")
const { validateLoopback } = require("./verify-medusa-connection.cjs")

test("acepta exclusivamente resolución localhost a loopback", () => {
  assert.doesNotThrow(() => validateLoopback([{ address: "::1" }, { address: "127.0.0.1" }]))
  assert.throws(() => validateLoopback([]))
  assert.throws(() => validateLoopback([{ address: "127.0.0.1" }, { address: "192.0.2.1" }]))
})
