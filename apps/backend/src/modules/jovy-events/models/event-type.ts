import { model } from "@medusajs/framework/utils"

const JovyEventType = model
  .define("jovy_event_type", {
    id: model.id().primaryKey(),
    code: model.text(),
    name: model.text(),
    description: model.text().nullable(),
  })
  .indexes([{ on: ["code"], unique: true }])

export default JovyEventType
