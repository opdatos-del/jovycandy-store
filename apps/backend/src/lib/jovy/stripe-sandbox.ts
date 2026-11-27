import { MedusaError } from "@medusajs/framework/utils"
import type { DeploymentEnvironment } from "./runtime-configuration"

/** Registra únicamente el provider oficial, sin fallback ni credenciales live. */
export function stripeSandboxModule(
  env: NodeJS.ProcessEnv,
  profile: DeploymentEnvironment,
) {
  if (env.JOVY_STRIPE_SANDBOX_ENABLED !== "true") return null

  if (profile !== "development") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Stripe sandbox solo se permite en entorno local.")
  }

  let database: URL | undefined
  try { database = new URL(env.DATABASE_URL ?? "") } catch { /* Rechazar sin incluir la URL. */ }
  const allowSharedDatabase = env.JOVY_STRIPE_SANDBOX_ALLOW_SHARED_DATABASE === "true"
  const protectedPort = database?.port === "5432" || database?.port === "55432"
  if (!database || !["postgres:", "postgresql:"].includes(database.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname) ||
      !database.port || (protectedPort && !allowSharedDatabase) || database.search) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA,
      allowSharedDatabase
        ? "Stripe sandbox exige PostgreSQL local con puerto explícito y sin parámetros en DATABASE_URL."
        : "Stripe sandbox exige PostgreSQL local aislado en un puerto explícito no protegido, sin parámetros en DATABASE_URL.")
  }

  const apiKey = env.STRIPE_API_KEY?.trim()
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim()
  const paymentMethodConfiguration = env.STRIPE_PAYMENT_METHOD_CONFIGURATION?.trim()
  if (!apiKey || !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(apiKey)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "STRIPE_API_KEY debe ser una clave de pruebas de Stripe.")
  }
  if (!webhookSecret || !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "STRIPE_WEBHOOK_SECRET es obligatorio y debe tener formato whsec_.")
  }
  if (paymentMethodConfiguration && !/^pmc_[A-Za-z0-9]+$/.test(paymentMethodConfiguration)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "STRIPE_PAYMENT_METHOD_CONFIGURATION debe ser un identificador pmc_.")
  }

  return {
    resolve: "@medusajs/medusa/payment",
    options: {
      providers: [{
        resolve: "@medusajs/medusa/payment-stripe",
        id: "stripe",
        options: {
          apiKey, webhookSecret, capture: false, automaticPaymentMethods: true,
          ...(paymentMethodConfiguration ? { paymentMethodConfiguration } : {}),
        },
      }],
    },
  }
}
