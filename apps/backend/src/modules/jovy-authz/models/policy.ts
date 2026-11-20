import { model } from "@medusajs/framework/utils"

const JovyAuthzPolicy = model
  .define("jovy_authz_policy", {
    id: model.id().primaryKey(),
    role_id: model.text(),
    resource: model.text(),
    operation: model.text(),
  })
  .indexes([
    { on: ["role_id", "resource", "operation"], unique: true },
    { on: ["resource", "operation"] },
  ])

export default JovyAuthzPolicy
