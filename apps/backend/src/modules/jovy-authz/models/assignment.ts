import { model } from "@medusajs/framework/utils"

const JovyAuthzAssignment = model
  .define("jovy_authz_assignment", {
    id: model.id().primaryKey(),
    user_id: model.text(),
    role_id: model.text(),
  })
  .indexes([{ on: ["user_id", "role_id"], unique: true }, { on: ["role_id"] }])

export default JovyAuthzAssignment
