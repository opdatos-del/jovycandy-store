import { MedusaService } from "@medusajs/framework/utils"
import JovyContactAuditLog from "./models/audit-log"
import JovyContactRequest from "./models/contact-request"

export default class JovyContactsModuleService extends MedusaService({
  JovyContactRequest,
  JovyContactAuditLog,
}) {}
