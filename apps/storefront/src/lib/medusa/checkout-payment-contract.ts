export const STRIPE_PROVIDER = "pp_stripe_stripe"
export const MANUAL_PROVIDER = "pp_system_default"

export function checkoutPaymentMode(env: NodeJS.ProcessEnv) {
  const local = (env.DEPLOYMENT_ENV ?? (env.NODE_ENV === "production" ? "production" : "development")) === "development"
  if (!local) return "disabled"
  if (env.JOVY_STRIPE_SANDBOX_ENABLED === "true") {
    try {
      const url = new URL(env.MEDUSA_BACKEND_URL ?? env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000")
      return ["http:", "https:"].includes(url.protocol) &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        hasCommerceSigningSecret(env) &&
        /^pk_test_[A-Za-z0-9]+$/.test(env.STRIPE_PUBLISHABLE_KEY ?? "") ? "stripe" : "disabled"
    } catch {
      return "disabled"
    }
  }
  return env.JOVY_MANUAL_CHECKOUT_FOR_E2E === "true"
    ? "manual"
    : "disabled"
}

export function hasCommerceSigningSecret(env: NodeJS.ProcessEnv) {
  const secret = env.JOVY_COMMERCE_SECRET?.trim()
  return Boolean(secret && secret.length >= 32 && secret !== "GENERATE_A_UNIQUE_LOCAL_SECRET")
}

export type NativePaymentSession = {
  id?: string
  provider_id?: string
  currency_code?: string
  amount?: number
  data?: {
    id?: string
    client_secret?: string
    amount?: number
    currency?: string
    livemode?: boolean
    payment_method_types?: string[]
    metadata?: { session_id?: string }
  }
}

/** Verifica el importe existente; nunca se usa para crear o actualizar un cobro. */
export function matchingStripeSession(
  cart: { total?: number | null; currency_code?: string | null },
  session?: NativePaymentSession,
) {
  const intent = session?.data
  if (
    typeof cart.total !== "number" || !Number.isFinite(cart.total) || cart.total <= 0 ||
    cart.currency_code !== "mxn" ||
    !session?.id || session.provider_id !== STRIPE_PROVIDER ||
    session.currency_code !== "mxn" || session.amount !== cart.total ||
    intent?.livemode !== false || intent.currency !== "mxn" ||
    !intent.payment_method_types?.includes("card") ||
    intent.payment_method_types.some((method) => !["card", "link"].includes(method)) ||
    intent.metadata?.session_id !== session.id || Math.round(cart.total * 100) !== intent.amount ||
    !intent.id?.startsWith("pi_") || !intent.client_secret?.startsWith(`${intent.id}_secret_`)
  ) return null

  return { sessionId: session.id, clientSecret: intent.client_secret }
}
