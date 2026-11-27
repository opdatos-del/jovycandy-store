import { createHmac } from "node:crypto"
import stripeModule from "@medusajs/medusa/payment-stripe"
import { stripeSandboxModule } from "../stripe-sandbox"

const environment = {
  JOVY_STRIPE_SANDBOX_ENABLED: "true",
  STRIPE_API_KEY: "sk_test_contractfixture",
  STRIPE_WEBHOOK_SECRET: "whsec_contractfixture",
  DATABASE_URL: "postgresql://127.0.0.1:65439/lab_fixture",
}

describe("Stripe sandbox registration", () => {
  it("does not register the provider by default", () => {
    expect(stripeSandboxModule({}, "development")).toBeNull()
  })

  it("registers the official provider with manual capture", () => {
    expect(stripeSandboxModule(environment, "development")).toEqual({
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [{
          resolve: "@medusajs/medusa/payment-stripe",
          id: "stripe",
          options: {
            apiKey: environment.STRIPE_API_KEY,
            webhookSecret: environment.STRIPE_WEBHOOK_SECRET,
            capture: false,
            automaticPaymentMethods: true,
          },
        }],
      },
    })
  })

  it.each(["sk_live_contractfixture", "rk_live_contractfixture", "", undefined])(
    "rejects a non-test secret without echoing it",
    (secret) => {
      expect(() => stripeSandboxModule({ ...environment, STRIPE_API_KEY: secret }, "development"))
        .toThrow(/^STRIPE_API_KEY debe ser una clave de pruebas de Stripe\.$/)
    },
  )

  it("requires a webhook signing secret", () => {
    expect(() => stripeSandboxModule({ ...environment, STRIPE_WEBHOOK_SECRET: "" }, "development"))
      .toThrow(/^STRIPE_WEBHOOK_SECRET es obligatorio/)
  })

  it("uses a dedicated Stripe payment method configuration when provided", () => {
    expect(stripeSandboxModule({
      ...environment, STRIPE_PAYMENT_METHOD_CONFIGURATION: "pmc_contractfixture",
    }, "development")).toMatchObject({
      options: { providers: [{ options: { paymentMethodConfiguration: "pmc_contractfixture" } }] },
    })
  })

  it("rejects a malformed payment method configuration without echoing its value", () => {
    expect(() => stripeSandboxModule({
      ...environment, STRIPE_PAYMENT_METHOD_CONFIGURATION: "invalid",
    }, "development")).toThrow(/^STRIPE_PAYMENT_METHOD_CONFIGURATION debe ser un identificador pmc_\.$/)
  })

  it.each(["staging", "production"] as const)("does not enable sandbox in %s", (profile) => {
    expect(() => stripeSandboxModule(environment, profile)).toThrow(/entorno local/)
  })

  it.each([
    "postgresql://example.test:65439/lab_fixture",
    "postgresql://127.0.0.1/lab_fixture",
    "postgresql://127.0.0.1:5432/lab_fixture",
    "postgresql://127.0.0.1:55432/lab_fixture",
    "postgresql://127.0.0.1:65439/lab_fixture?host=example.test",
  ])("rejects a non-isolated database URL: %s", (DATABASE_URL) => {
    expect(() => stripeSandboxModule({ ...environment, DATABASE_URL }, "development"))
      .toThrow(/^Stripe sandbox exige PostgreSQL local aislado/)
  })

  it("permits the shared dev database only with the explicit opt-in", () => {
    expect(stripeSandboxModule({
      ...environment,
      DATABASE_URL: "postgresql://127.0.0.1:5432/lab_fixture",
      JOVY_STRIPE_SANDBOX_ALLOW_SHARED_DATABASE: "true",
    }, "development")).toMatchObject({ options: { providers: [{ id: "stripe" }] } })
    expect(() => stripeSandboxModule({
      ...environment,
      DATABASE_URL: "postgresql://127.0.0.1:5432/lab_fixture",
      JOVY_STRIPE_SANDBOX_ALLOW_SHARED_DATABASE: "true",
    }, "production")).toThrow(/entorno local/)
  })
})

describe("installed Stripe provider webhook contract (offline)", () => {
  const StripeProvider = stripeModule.services.find((service) => "identifier" in service && service.identifier === "stripe")!
  const provider = new StripeProvider({}, {
    apiKey: environment.STRIPE_API_KEY,
    webhookSecret: environment.STRIPE_WEBHOOK_SECRET,
  })

  function fixture(type: string, session = "payses_fixture", secret = environment.STRIPE_WEBHOOK_SECRET, age = 0) {
    const data = {
      type,
      data: { object: {
        currency: "mxn", amount: 10245, amount_received: 10245, amount_capturable: 10245,
        metadata: { session_id: session },
      } },
    }
    const rawData = JSON.stringify(data)
    const timestamp = Math.floor(Date.now() / 1000) - age
    const hash = createHmac("sha256", secret).update(`${timestamp}.${rawData}`).digest("hex")
    return { data, rawData, headers: { "stripe-signature": `t=${timestamp},v1=${hash}` } }
  }

  it.each([
    ["payment_intent.amount_capturable_updated", "authorized"],
    ["payment_intent.succeeded", "captured"],
    ["payment_intent.payment_failed", "failed"],
    ["payment_intent.canceled", "canceled"],
    ["payment_intent.requires_action", "requires_more"],
  ])("maps %s using the Medusa session and MXN units", async (type, action) => {
    await expect(provider.getWebhookActionAndData(fixture(type))).resolves.toMatchObject({
      action, data: { session_id: "payses_fixture", amount: 102.45 },
    })
  })

  it("rejects invalid signatures and stale signatures", async () => {
    await expect(provider.getWebhookActionAndData(fixture("payment_intent.succeeded", undefined, "other_secret"))).rejects.toThrow(/signature/i)
    await expect(provider.getWebhookActionAndData(fixture("payment_intent.succeeded", undefined, undefined, 600))).rejects.toThrow(/tolerance/i)
  })

  it("does not handle refunds initiated outside Medusa or events without its session", async () => {
    await expect(provider.getWebhookActionAndData(fixture("charge.refunded"))).resolves.toEqual({ action: "not_supported" })
    await expect(provider.getWebhookActionAndData(fixture("payment_intent.succeeded", ""))).resolves.toEqual({ action: "not_supported" })
  })
})
