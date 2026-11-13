import { MedusaService } from "@medusajs/framework/utils"
import HeroItem from "./models/hero-item"
import HeroSettings from "./models/hero-settings"
import MarketingAuditLog from "./models/audit-log"
import MarketingBanner from "./models/marketing-banner"

type HeroGraphService = {
  listHeroItems: (filters?: unknown, config?: unknown) => Promise<unknown[]>
  listAndCountHeroItems: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
}

class JovyMarketingModuleService extends MedusaService({
  HeroItem,
  HeroSettings,
  MarketingBanner,
  MarketingAuditLog,
}) {
  /**
   * `@medusajs/query` resolves a DML alias by calling
   * `list${methodSuffix}` / `listAndCount${methodSuffix}`. The entity is
   * `JovyHeroItem`, but `MedusaService` names the generated methods after the
   * import key (`HeroItem`), so these aliases expose the names that
   * `query.graph` uses for the product ↔ hero Module Link.
   */
  async listJovyHeroItems(filters?: unknown, config?: unknown) {
    return (this as unknown as HeroGraphService).listHeroItems(filters, config)
  }

  async listAndCountJovyHeroItems(filters?: unknown, config?: unknown) {
    return (this as unknown as HeroGraphService).listAndCountHeroItems(filters, config)
  }
}

export default JovyMarketingModuleService
