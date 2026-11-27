/**
 * Crea o repara una cuenta de administrador con rol Superadministrador.
 *
 * Solo laboratorio local (nunca `production`):
 *
 *   pnpm --dir apps/backend superadmin:create -- \
 *     --email=admin@jovy.test --password="una-contraseña-larga" \
 *     --first-name=Admin --last-name=Jovy
 *
 * - Si la identidad `emailpass` no existe, la registra.
 * - Si ya existe, actualiza su contraseña cuando se proporciona `--password`.
 * - Reutiliza o crea el usuario y enlaza la identidad con `app_metadata.user_id`.
 * - Garantiza los roles del sistema y asigna `superadmin` con el servicio de
 *   autorización. No imprime ni registra contraseñas.
 */
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"
import { JOVY_AUTHZ_MODULE } from "@jovy/modules/jovy-authz"
import type JovyAuthzModuleService from "@jovy/modules/jovy-authz/service"

const MIN_PASSWORD_LENGTH = 16
const SUPERADMIN_CODE = "superadmin"

function readFlag(args: string[], name: string) {
  const prefix = `--${name}=`
  const match = args.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : ""
}

function assertLocalOnly() {
  const deployment = (process.env.DEPLOYMENT_ENV ?? "").trim().toLowerCase()
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase()
  if (nodeEnv === "production" || (deployment && deployment !== "development")) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Esta operación solo se permite en un entorno local de desarrollo.",
    )
  }
}

export default async function createSuperadmin({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  assertLocalOnly()

  const email = (readFlag(args, "email") || process.env.JOVY_SUPERADMIN_EMAIL?.trim() || "").toLowerCase()
  const password = readFlag(args, "password") || process.env.JOVY_SUPERADMIN_PASSWORD?.trim() || ""
  const firstName = readFlag(args, "first-name") || process.env.JOVY_SUPERADMIN_FIRST_NAME?.trim() || "Admin"
  const lastName = readFlag(args, "last-name") || process.env.JOVY_SUPERADMIN_LAST_NAME?.trim() || "Jovy"

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Indica un correo válido con --email=...")
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    )
  }

  const auth = container.resolve(Modules.AUTH)
  const users = container.resolve(Modules.USER)

  let identity = await auth.register("emailpass", { body: { email, password }, protocol: "https" })
  let identityId = identity.authIdentity?.id

  if (!identityId) {
    // La identidad ya existe: se repara la contraseña y se recupera su id.
    const login = await auth.authenticate("emailpass", { body: { email, password } })
    identityId = login.authIdentity?.id
    if (!identityId) {
      const updated = await auth.updateProvider("emailpass", { entity_id: email, password })
      const retried = await auth.authenticate("emailpass", { body: { email, password } })
      identityId = retried.authIdentity?.id
      if (!identityId || !updated?.success) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "No se pudo registrar ni actualizar la identidad. Revisa los datos o el proveedor de autenticación.",
        )
      }
    }
  }

  const existingUsers = await users.listUsers({ email })
  const user =
    existingUsers[0] ??
    (await users.createUsers({ email, first_name: firstName, last_name: lastName }))

  const current = await auth.retrieveAuthIdentity(identityId)
  if (!current.app_metadata?.user_id) {
    await auth.updateAuthIdentities({
      id: identityId,
      app_metadata: { ...current.app_metadata, user_id: user.id },
    })
  }

  const authz = container.resolve(JOVY_AUTHZ_MODULE) as JovyAuthzModuleService
  await authz.ensureSystemRoles()
  const [role] = await authz.listJovyAuthzRoles({ code: SUPERADMIN_CODE })
  if (!role) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "No existe el rol superadmin.")
  }
  await authz.replaceUserAccess(user.id, [role.id], [], null)

  logger.info(`[superadmin] acceso garantizado para ${email} (usuario ${user.id}).`)
  logger.info("[superadmin] contraseña no registrada en logs; guárdala en tu gestor de secretos.")
}
