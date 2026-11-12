import { MedusaService } from "@medusajs/framework/utils"
import HeroItem from "./models/hero-item"
import HeroSettings from "./models/hero-settings"
import MarketingAuditLog from "./models/audit-log"
import MarketingBanner from "./models/marketing-banner"

class JovyMarketingModuleService extends MedusaService({
  HeroItem,
  HeroSettings,
  MarketingBanner,
  MarketingAuditLog,
}) {}

export default JovyMarketingModuleService
