import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import JovyBrandAuditLog from "./models/audit-log"
import JovyGalleryItem from "./models/gallery-item"
import JovyBrandLogo from "./models/logo"
import JovyBrandLogoFamily from "./models/logo-family"

type BrandLogo = {
  id: string
  slug: string
  name: string
  alt: string | null
  families: string[] | null
  families_linked: boolean
  media_file_id: string
  crop: { zoom: number; offset_x: number; offset_y: number } | null
  enabled: boolean
  sort_order: number
}

export type BrandLogoFamily = {
  id: string
  logo_id: string
  family_id: string
}

type RuntimeLogoMethods = {
  listJovyBrandLogos: (filters: Record<string, unknown>, config?: Record<string, unknown>) => Promise<BrandLogo[]>
  createJovyBrandLogos: (data: Record<string, unknown>) => Promise<BrandLogo | BrandLogo[]>
  updateJovyBrandLogos: (data: Record<string, unknown>) => Promise<BrandLogo | BrandLogo[]>
  deleteJovyBrandLogos: (id: string) => Promise<void>
}

type RuntimeLogoFamilyMethods = {
  listJovyBrandLogoFamilies: (filters: Record<string, unknown>, config?: Record<string, unknown>) => Promise<BrandLogoFamily[]>
  createJovyBrandLogoFamilies: (data: Record<string, unknown> | Record<string, unknown>[]) => Promise<BrandLogoFamily | BrandLogoFamily[]>
  deleteJovyBrandLogoFamilies: (ids: string | string[]) => Promise<void>
}

function one<T>(value: T | T[]): T {
  const result = Array.isArray(value) ? value[0] : value
  if (!result) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Medusa no devolvió el logo guardado")
  return result
}

class JovyBrandModuleService extends MedusaService({ JovyGalleryItem, JovyBrandLogo, JovyBrandLogoFamily, JovyBrandAuditLog }) {
  /**
   * Medusa's runtime inflector uses `Logos` while the generated TypeScript
   * declaration exposes `Logoes`. Keep that implementation detail here.
   */
  private get logosRuntime() {
    return this as unknown as RuntimeLogoMethods
  }

  /** Igual que los logos, el inflector generado puede no coincidir con el runtime. */
  private get logoFamiliesRuntime() {
    return this as unknown as RuntimeLogoFamilyMethods
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

  async listLogoFamilies(filters: Record<string, unknown> = {}): Promise<BrandLogoFamily[]> {
    return this.logoFamiliesRuntime.listJovyBrandLogoFamilies(filters)
  }

  /**
   * El borrado de un logo debe retirar sus vínculos: la tabla no declara FK
   * entre módulos, así que nadie más los limpia y quedarían filas huérfanas.
   */
  async deleteLogoFamilies(ids: string[]): Promise<void> {
    if (!ids.length) return
    await this.logoFamiliesRuntime.deleteJovyBrandLogoFamilies(ids)
  }

  /**
   * Reemplaza la selección de familias del logo y marca la relación como
   * vinculada. El llamador ya validó existencia y `active` contra el catálogo y
   * sostiene el lock de escritura de logos, así que aquí solo se aplica el diff.
   */
  async setLogoFamilies(logoId: string, familyIds: string[]): Promise<BrandLogoFamily[]> {
    const current = await this.listLogoFamilies({ logo_id: logoId })
    const next = new Set(familyIds)
    const removed = current.filter((row) => !next.has(row.family_id)).map((row) => row.id)
    const linked = new Set(current.map((row) => row.family_id))
    const added = familyIds.filter((familyId) => !linked.has(familyId))

    if (removed.length) await this.logoFamiliesRuntime.deleteJovyBrandLogoFamilies(removed)
    if (added.length) {
      await this.logoFamiliesRuntime.createJovyBrandLogoFamilies(added.map((familyId) => ({ logo_id: logoId, family_id: familyId })))
    }
    await this.logosRuntime.updateJovyBrandLogos({ id: logoId, families_linked: true })
    return this.listLogoFamilies({ logo_id: logoId })
  }
}

export default JovyBrandModuleService
