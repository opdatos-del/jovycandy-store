import { model } from "@medusajs/framework/utils"

const JovyAuthzRole = model
  .define("jovy_authz_role", {
    id: model.id().primaryKey(),
    code: model.text(),
    name: model.text(),
    description: model.text().nullable(),
    is_system: model.boolean().default(false),
  })
  .indexes([{ on: ["code"], unique: true }])

export default JovyAuthzRole
