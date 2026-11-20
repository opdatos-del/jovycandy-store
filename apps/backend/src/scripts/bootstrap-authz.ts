/**
 * Bootstrap operativo de autorización (instalación o recuperación).
 *
 * Instalación inicial (solo si no existe ningún Superadministrador):
 *
 *   pnpm --dir apps/backend exec medusa exec ./src/scripts/bootstrap-authz.ts \
 *     -- --user-id=usr_xxx
 *
 * Recuperación del último Superadministrador (requiere confirmación explícita):
 *
 *   pnpm --dir apps/backend exec medusa exec ./src/scripts/bootstrap-authz.ts \
 *     -- --user-id=usr_xxx --mode=recovery --confirm=recover-superadmin
 *
 * Reglas:
 * - Nunca se ejecuta desde una petición HTTP ni desde una variable de entorno.
 * - La siembra de roles y la asignación se ejecutan en la misma transacción.
 * - `bootstrap` se rechaza si ya hay un Superadministrador.
 * - `recovery` exige `--confirm=recover-superadmin` y deja auditoría con modo.
 * - Reejecutarlo para el mismo usuario es idempotente.
 */
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"
import { JOVY_AUTHZ_MODULE } from "@jovy/modules/jovy-authz"
import type JovyAuthzModuleService from "@jovy/modules/jovy-authz/service"

type Mode = "bootstrap" | "recovery"
const RECOVERY_CONFIRMATION = "recover-superadmin"

function readFlag(args: string[], name: string) {
  const prefix = `--${name}=`
  const match = args.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : ""
}

function resolveUser(container: ExecArgs["container"], userId: string, email: string) {
  const userModule = container.resolve(Modules.USER)
  if (userId) {
    return userModule.retrieveUser(userId).catch(() => {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No existe un usuario con id ${userId}.`,
      )
    })
  }
  if (email) {
    return userModule.listUsers({ email }).then((users) => {
      if (users.length !== 1) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Se esperaba exactamente un usuario con el correo indicado; encontrados: ${users.length}.`,
        )
      }
      return users[0]
    })
  }
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Indica el usuario objetivo con --user-id=usr_... o --email=...",
  )
}

export default async function bootstrapAuthz({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const userId = readFlag(args, "user-id")
  const email = readFlag(args, "email").toLowerCase()
  const requestedMode = readFlag(args, "mode") || "bootstrap"
  const confirmation = readFlag(args, "confirm")

  if (requestedMode !== "bootstrap" && requestedMode !== "recovery") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Modo no válido: ${requestedMode}. Usa bootstrap o recovery.`,
    )
  }
  const mode: Mode = requestedMode
  if (mode === "recovery" && confirmation !== RECOVERY_CONFIRMATION) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `La recuperación exige --confirm=${RECOVERY_CONFIRMATION}.`,
    )
  }

  const user = await resolveUser(container, userId, email)
  const authz = container.resolve(JOVY_AUTHZ_MODULE) as JovyAuthzModuleService

  await authz.ensureSystemRoles()
  const result = await authz.assignBootstrapSuperadmin({ userId: user.id, mode })

  if (result === "already") {
    logger.info(`[authz] ${user.email} ya tiene el rol superadmin; no se modificó nada.`)
    return
  }
  logger.info(`[authz] superadmin asignado a ${user.email} (modo ${mode}).`)
}
