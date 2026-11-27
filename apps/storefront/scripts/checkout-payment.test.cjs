"use strict"
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require("node:assert/strict")
const { test } = require("node:test")
const {
  checkoutPaymentMode,
  matchingStripeSession,
} = require("../src/lib/medusa/checkout-payment-contract.ts")

const key = "pk_test_contractfixture"
const signingSecret = "local-offline-fixture-for-commerce-signing"
const cart = { currency_code: "mxn", total: 102.45 }
const session = {
  id: "payses_contract",
  provider_id: "pp_stripe_stripe",
  currency_code: "mxn",
  amount: 102.45,
  data: {
    id: "pi_contract",
    client_secret: "pi_contract_secret_fixture",
    amount: 10245,
    currency: "mxn",
    payment_method_types: ["card", "link"],
    livemode: false,
    metadata: { session_id: "payses_contract" },
  },
}

test("no hay fallback de pago manual por defecto o ante claves live", () => {
  assert.equal(checkoutPaymentMode({}), "disabled")
  assert.equal(checkoutPaymentMode({ JOVY_MANUAL_CHECKOUT_FOR_E2E: "true" }), "manual")
  for (const key of ["", "pk_live_contractfixture"]) {
    assert.equal(checkoutPaymentMode({
      JOVY_STRIPE_SANDBOX_ENABLED: "true",
      JOVY_MANUAL_CHECKOUT_FOR_E2E: "true",
      STRIPE_PUBLISHABLE_KEY: key,
    }), "disabled")
  }
  assert.equal(checkoutPaymentMode({
    JOVY_STRIPE_SANDBOX_ENABLED: "true",
    STRIPE_PUBLISHABLE_KEY: key,
    JOVY_COMMERCE_SECRET: signingSecret,
  }), "stripe")
  assert.equal(checkoutPaymentMode({
    JOVY_STRIPE_SANDBOX_ENABLED: "true", STRIPE_PUBLISHABLE_KEY: key,
    MEDUSA_BACKEND_URL: "https://external.example",
    JOVY_COMMERCE_SECRET: signingSecret,
  }), "disabled")
  assert.equal(checkoutPaymentMode({
    JOVY_STRIPE_SANDBOX_ENABLED: "true", STRIPE_PUBLISHABLE_KEY: key,
  }), "disabled")
})

test("solo acepta una sesión Stripe de prueba vinculada y con monto vigente", () => {
  assert.deepEqual(matchingStripeSession(cart, session), {
    sessionId: session.id,
    clientSecret: session.data.client_secret,
  })
  assert.equal(matchingStripeSession({ ...cart, total: 0 }, session), null)
  assert.equal(matchingStripeSession({ ...cart, total: 103 }, session), null)
  assert.equal(matchingStripeSession({ ...cart, currency_code: "usd" }, session), null)
  assert.equal(matchingStripeSession(cart, { ...session, provider_id: "pp_system_default" }), null)
  for (const data of [
    { ...session.data, livemode: true },
    { ...session.data, amount: 10244 },
    { ...session.data, currency: "usd" },
    { ...session.data, metadata: { session_id: "another" } },
    { ...session.data, payment_method_types: ["card", "oxxo"] },
    { ...session.data, payment_method_types: ["link"] },
  ]) {
    assert.equal(matchingStripeSession(cart, { ...session, data }), null)
  }
})
