import { model } from "@medusajs/framework/utils"

export const CommunicationPreference = model.define("jovy_communication_preference", {
  id: model.id({ prefix: "jcp" }).primaryKey(),
  customer_id: model.text(),
  marketing_email: model.boolean().default(false),
  consent_at: model.dateTime().nullable(),
}).indexes([{ on: ["customer_id"], unique: true }])
