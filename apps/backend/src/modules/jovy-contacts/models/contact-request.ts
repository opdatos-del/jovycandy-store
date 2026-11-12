import { model } from "@medusajs/framework/utils"

export default model
  .define("jovy_contact_request", {
    id: model.id().primaryKey(),
    first_name: model.text(),
    last_name: model.text().nullable(),
    email: model.text(),
    phone: model.text().nullable(),
    country: model.text().nullable(),
    city: model.text().nullable(),
    postal_code: model.text().nullable(),
    contact_type: model.enum(["national-sales", "international-sales", "customer-service", "catalogue"]),
    message: model.text(),
    status: model.enum(["pending", "handled"]).default("pending"),
    handled_at: model.dateTime().nullable(),
    handled_by: model.text().nullable(),
    admin_notes: model.text().nullable(),
  })
  .indexes([{ on: ["status", "contact_type", "created_at"] }, { on: ["email"] }])
