import type { MedusaContainer } from "@medusajs/framework/types"
import { ApiKeyType, MedusaError, Modules, PUBLISHABLE_KEY_HEADER } from "@medusajs/framework/utils"
import type { MedusaSuiteOptions } from "@medusajs/test-utils"

/** Axios instance handed over by `medusaIntegrationTestRunner`. */
export type TestApi = MedusaSuiteOptions["api"]

export const ADMIN_EMAIL = "admin.integration@jovy.test"
const ADMIN_PASSWORD = "Integration-Test-1234"

/**
 * A fresh publishable key per suite. It is created before the runner takes its
 * database snapshot, so the key survives every per-test restore.
 */
export async function createPublishableApiKey(container: MedusaContainer) {
  const apiKeyModule = container.resolve(Modules.API_KEY)
  const key = await apiKeyModule.createApiKeys({
    title: "Jovy integration tests",
    type: ApiKeyType.PUBLISHABLE,
    created_by: "integration-test",
  })

  return key.token
}

export function storeHeaders(publishableApiKey: string) {
  return { [PUBLISHABLE_KEY_HEADER]: publishableApiKey }
}

export function adminHeaders(token: string) {
  return { authorization: `Bearer ${token}` }
}

/**
 * Creates an admin user linked to an emailpass auth identity and returns the
 * bearer token issued by the real authentication route. Signing a token by hand
 * would test the JWT secret instead of the admin contract.
 */
export async function createAdminSession(container: MedusaContainer, api: TestApi) {
  const authModule = container.resolve(Modules.AUTH)
  const userModule = container.resolve(Modules.USER)

  const registration = await authModule.register("emailpass", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    protocol: "https",
  })

  const authIdentity = registration.authIdentity
  if (!authIdentity) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "No se pudo registrar la identidad de prueba")
  }

  const user = await userModule.createUsers({
    email: ADMIN_EMAIL,
    first_name: "Integration",
    last_name: "Admin",
  })

  await authModule.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { user_id: user.id },
  })

  const { data } = await api.post("/auth/user/emailpass", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })

  return data.token as string
}
