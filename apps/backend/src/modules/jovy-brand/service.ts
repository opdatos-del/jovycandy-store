import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import JovyBrandAuditLog from "./models/audit-log"
import JovyGalleryItem from "./models/gallery-item"
import JovyBrandLogo from "./models/logo"

type BrandLogo = {
  id: string
  slug: string
  name: string
  alt: string | null
  families: string[] | null
  media_file_id: string
  crop: { zoom: number; offset_x: number; offset_y: number } | null
  enabled: boolean
  sort_order: number
}

type RuntimeLogoMethods = {
  listJovyBrandLogos: (filters: Record<string, unknown>, config?: Record<string, unknown>) => Promise<BrandLogo[]>
  createJovyBrandLogos: (data: Record<string, unknown>) => Promise<BrandLogo | BrandLogo[]>
  updateJovyBrandLogos: (data: Record<string, unknown>) => Promise<BrandLogo | BrandLogo[]>
  deleteJovyBrandLogos: (id: string) => Promise<void>
}

function one<T>(value: T | T[]): T {
  const result = Array.isArray(value) ? value[0] : value
  if (!result) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Medusa no devolvió el logo guardado")
  return result
}

class JovyBrandModuleService extends MedusaService({ JovyGalleryItem, JovyBrandLogo, JovyBrandAuditLog }) {
  /**
   * Medusa's runtime inflector uses `Logos` while the generated TypeScript
   * declaration exposes `Logoes`. Keep that implementation detail here.
   */
  private get logosRuntime() {
    return this as unknown as RuntimeLogoMethods
  }

  async listLogos(filters: Record<string, unknown> = {}, config?: Record<string, unknown>): Promise<BrandLogo[]> {
    return this.logosRuntime.listJovyBrandLogos(filters, config)
  }

  async createLogo(data: Record<string, unknown>): Promise<BrandLogo> {
    return one(await this.logosRuntime.createJovyBrandLogos(data))
  }

  async updateLogo(data: Record<string, unknown>): Promise<BrandLogo> {
    return one(await this.logosRuntime.updateJovyBrandLogos(data))
  }

  async deleteLogo(id: string): Promise<void> {
    return this.logosRuntime.deleteJovyBrandLogos(id)
  }
}

export default JovyBrandModuleService
