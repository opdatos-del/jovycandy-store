import { MedusaService } from "@medusajs/framework/utils"
import CatalogueCategory from "./models/catalogue-category"
import ProductFamily from "./models/product-family"

type FamilyGraphService = {
  listProductFamilies: (filters?: unknown, config?: unknown) => Promise<unknown[]>
  listAndCountProductFamilies: (filters?: unknown, config?: unknown) => Promise<[unknown[], number]>
}

class JovyCatalogueModuleService extends MedusaService({
  CatalogueCategory,
  ProductFamily,
}) {
  /**
   * `@medusajs/query` resuelve un alias DML llamando
   * `list${methodSuffix}` / `listAndCount${methodSuffix}`. La entidad es
   * `JovyProductFamily`, pero `MedusaService` nombra los métodos generados a
   * partir de la clave de importación (`ProductFamily`); estos alias exponen
   * los nombres que `query.graph` usa para la relación familia ↔ producto.
   */
  async listJovyProductFamilies(filters?: unknown, config?: unknown) {
    return (this as unknown as FamilyGraphService).listProductFamilies(filters, config)
  }

  async listAndCountJovyProductFamilies(filters?: unknown, config?: unknown) {
    return (this as unknown as FamilyGraphService).listAndCountProductFamilies(filters, config)
  }
}

export default JovyCatalogueModuleService
