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

  // El runner reutiliza la base entre corridas: si una sesión anterior dejó la
  // identidad o el usuario, `register`/`createUsers` fallan y todas las pruebas
  // del suite caen en `beforeAll`. Reutilizamos esas entidades en lugar de
  // asumir una base limpia, sin tocar el comportamiento del contrato probado.
  let authIdentity = registration.authIdentity as
    | { id: string }
    | undefined
  if (!authIdentity) {
    // El email vive en la identidad del proveedor, no en `auth_identity`.
    const providerIdentities = (await authModule.listProviderIdentities({
      provider: "emailpass",
      entity_id: ADMIN_EMAIL,
    })) as Array<{ auth_identity_id: string }>
    const existing = providerIdentities[0]
    if (existing) {
      authIdentity = { id: existing.auth_identity_id }
    }
  }

  if (!authIdentity) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `No se pudo registrar la identidad de prueba: ${String((registration as { error?: unknown }).error ?? "sin detalle")}`
    )
  }

  const existingUsers = await userModule.listUsers({ email: ADMIN_EMAIL })
  const user =
    existingUsers[0] ??
    (await userModule.createUsers({
      email: ADMIN_EMAIL,
      first_name: "Integration",
      last_name: "Admin",
    }))

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
