import { model } from "@medusajs/framework/utils"

export const CustomerNotice = model.define("jovy_customer_notice", {
  id: model.id({ prefix: "jcn" }).primaryKey(),
  customer_id: model.text(),
  order_id: model.text(),
  event_key: model.text(),
  kind: model.enum(["order_placed", "order_canceled"]),
  read_at: model.dateTime().nullable(),
}).indexes([
  { on: ["customer_id", "created_at"] },
  { on: ["event_key"], unique: true },
])
