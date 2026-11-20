import { model } from "@medusajs/framework/utils"

/**
 * Ajustes individuales sobre la unión de roles. `deny` gana sobre cualquier
 * concesión, incluida la de otro rol. No sustituye la asignación de roles: la
 * excepción queda visible y auditable por usuario.
 */
const JovyAuthzUserPolicy = model
  .define("jovy_authz_user_policy", {
    id: model.id().primaryKey(),
    user_id: model.text(),
    resource: model.text(),
    operation: model.text(),
    effect: model.enum(["allow", "deny"]),
  })
  .indexes([
    { on: ["user_id", "resource", "operation"], unique: true },
    { on: ["user_id", "effect"] },
  ])

export default JovyAuthzUserPolicy
