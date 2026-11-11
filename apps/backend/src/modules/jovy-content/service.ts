import { MedusaService } from "@medusajs/framework/utils"
import AuditLog from "./models/audit-log"
import EditorialPage from "./models/editorial-page"

class JovyContentModuleService extends MedusaService({
  EditorialPage,
  AuditLog,
}) {}

export default JovyContentModuleService
