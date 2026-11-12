import { MedusaService } from "@medusajs/framework/utils"
import JovyEvent from "./models/event"
import JovyEventAuditLog from "./models/audit-log"
import JovyEventType from "./models/event-type"

class JovyEventsModuleService extends MedusaService({
  JovyEvent,
  JovyEventType,
  JovyEventAuditLog,
}) {}

export default JovyEventsModuleService
