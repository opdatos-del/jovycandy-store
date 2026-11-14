import path from "node:path"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import type JovyCatalogueModuleService from "@jovy/modules/jovy-catalogue/service"

import { adminHeaders, createAdminSession, createPublishableApiKey, storeHeaders } from "./utils"

jest.setTimeout(120_000)

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLfkQAAAABJRU5ErkJggg==",
  "base64",
)

type LogoFamilyLabel = { id: string; slug: string; name: string }
type Logo = {
  id: string
  slug: string
  name: string
  families: string[] | null
  families_linked: boolean
  family_ids: string[]
  family_labels: LogoFamilyLabel[]
  unmapped_families: string[]
  media_url: string | null
  crop: { zoom: number; offset_x: number; offset_y: number } | null
}

type StoreLogo = {
  id: string
  families: string[] | null
  family_ids: string[]
  family_slugs: string[]
  media_url: string | null
}

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-brand-families",
  testSuite: ({ api, getContainer }) => {
    let adminToken: string
    let publishableApiKey: string
    let mediaFileId: string
    let activeFamilyId: string
    let otherFamilyId: string
    let inactiveFamilyId: string

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
      adminToken = await createAdminSession(getContainer(), api)

      // Datos creados antes del snapshot: sobreviven a la restauración por prueba.
      const catalogue = getContainer().resolve(JOVY_CATALOGUE_MODULE) as JovyCatalogueModuleService
      const [chamoy, pinatero, retirada] = await catalogue.createProductFamilies([
        { name: "Chamoy", slug: "chamoy", active: true, sort_order: 1 },
        { name: "Piñatero", slug: "pinatero", active: true, sort_order: 2 },
        { name: "Retirada", slug: "retirada", active: false, sort_order: 3 },
      ])
      activeFamilyId = chamoy.id
      otherFamilyId = pinatero.id
      inactiveFamilyId = retirada.id

      const files = getContainer().resolve(Modules.FILE)
      mediaFileId = (await files.createFiles({
        filename: "brand-families.png",
        mimeType: "image/png",
        content: PNG.toString("base64"),
        access: "public",
      })).id
    })

    const adminConfig = () => ({ headers: adminHeaders(adminToken), validateStatus: () => true })

    const logoPayload = (overrides: Record<string, unknown> = {}) => ({
      slug: "jovy-corporativo",
      name: "Jovy Corporativo",
      media_file_id: mediaFileId,
      crop: { zoom: 1.25, offset_x: 12, offset_y: -4 },
      enabled: true,
      sort_order: 0,
      ...overrides,
    })

    const createLogo = (overrides: Record<string, unknown> = {}) =>
      api.post("/admin/jovy/brand/logos", logoPayload(overrides), adminConfig())

    const listLogos = () => api.get("/admin/jovy/brand/logos", adminConfig())

    const storeLogos = (family?: string, key = publishableApiKey) =>
      api.get("/store/jovy/brand/logos", {
        headers: storeHeaders(key),
        params: family === undefined ? {} : { family },
        validateStatus: () => true,
      })

    it("exige sesión de administrador en la gestión de logos", async () => {
      expect((await api.get("/admin/jovy/brand/logos", { validateStatus: () => true })).status).toBe(401)
      expect((await api.post("/admin/jovy/brand/logos", logoPayload(), { validateStatus: () => true })).status).toBe(401)
      expect(
        (await api.put("/admin/jovy/brand/logos/jlogo_missing", { family_ids: [] }, { validateStatus: () => true })).status,
      ).toBe(401)
    })

    it("crea un logo con familias reales y resuelve sus etiquetas", async () => {
      const created = await createLogo({ family_ids: [activeFamilyId, otherFamilyId] })
      expect(created.status).toBe(201)
      expect(created.data.logo).toMatchObject({
        family_ids: [activeFamilyId, otherFamilyId],
        families_linked: true,
        families: null,
        crop: { zoom: 1.25, offset_x: 12, offset_y: -4 },
        media_url: expect.stringContaining("brand-families.png"),
      })
      expect((created.data.logo.family_labels as LogoFamilyLabel[]).map((family) => family.slug)).toEqual([
        "chamoy",
        "pinatero",
      ])

      const listed = await listLogos()
      expect(listed.status).toBe(200)
      const stored = (listed.data.logos as Logo[]).find((logo) => logo.id === created.data.logo.id)
      expect(stored?.family_ids).toEqual([activeFamilyId, otherFamilyId])
      expect(stored?.unmapped_families).toEqual([])
      expect(stored?.media_url).toContain("brand-families.png")
    })

    it("rechaza identificadores desconocidos e inactivos sin crear el logo", async () => {
      const unknown = await createLogo({ family_ids: ["fam_inexistente"] })
      expect(unknown.status).toBe(400)
      expect(unknown.data.message).toBe("Una o más familias seleccionadas no existen")

      const inactive = await createLogo({ family_ids: [inactiveFamilyId] })
      expect(inactive.status).toBe(400)
      expect(inactive.data.message).toBe("Una o más familias seleccionadas están inactivas")

      const duplicated = await createLogo({ family_ids: [activeFamilyId, activeFamilyId] })
      expect(duplicated.status).toBe(400)

      expect(((await listLogos()).data.logos as Logo[]).filter((logo) => logo.slug === "jovy-corporativo")).toHaveLength(0)
    })

    it("conserva el legado no mapeado como advertencia y permite migrarlo a la relación", async () => {
      const legacy = await createLogo({ slug: "logo-legado", name: "Logo legado", families: ["chamoy", "corporativa"] })
      expect(legacy.status).toBe(201)
      expect(legacy.data.logo).toMatchObject({
        families_linked: false,
        families: ["chamoy", "corporativa"],
        family_ids: [activeFamilyId],
        unmapped_families: ["corporativa"],
      })

      const migrated = await api.put(
        `/admin/jovy/brand/logos/${legacy.data.logo.id}`,
        { family_ids: [otherFamilyId] },
        adminConfig(),
      )
      expect(migrated.status).toBe(200)
      expect(migrated.data.logo).toMatchObject({
        families_linked: true,
        family_ids: [otherFamilyId],
        // El array legado no se borra: sigue disponible para lectura y auditoría.
        families: ["chamoy", "corporativa"],
        unmapped_families: ["corporativa"],
      })
      expect(migrated.data.logo.crop).toEqual({ zoom: 1.25, offset_x: 12, offset_y: -4 })
    })

    it("filtra la Store por familia real y mantiene el filtro legado", async () => {
      const linked = await createLogo({ slug: "logo-chamoy", family_ids: [activeFamilyId] })
      const legacy = await createLogo({ slug: "logo-corporativo", name: "Logo corporativo", families: ["corporativa"] })
      const everywhere = await createLogo({ slug: "logo-todas", name: "Logo todas", family_ids: [] })
      expect([linked.status, legacy.status, everywhere.status]).toEqual([201, 201, 201])

      const byId = await storeLogos(activeFamilyId)
      expect(byId.status).toBe(200)
      const byIdIds = (byId.data.logos as StoreLogo[]).map((logo) => logo.id)
      expect(byIdIds).toContain(linked.data.logo.id)
      expect(byIdIds).toContain(everywhere.data.logo.id)
      expect(byIdIds).not.toContain(legacy.data.logo.id)

      const bySlug = await storeLogos("chamoy")
      expect((bySlug.data.logos as StoreLogo[]).map((logo) => logo.id)).toEqual(byIdIds)

      const otherFamily = await storeLogos("pinatero")
      expect((otherFamily.data.logos as StoreLogo[]).map((logo) => logo.id)).not.toContain(linked.data.logo.id)
      expect((otherFamily.data.logos as StoreLogo[]).map((logo) => logo.id)).toContain(everywhere.data.logo.id)

      // El slug legado sin familia canónica sigue filtrando hasta que se migre.
      const legacyOnly = await storeLogos("corporativa")
      expect((legacyOnly.data.logos as StoreLogo[]).map((logo) => logo.id)).toContain(legacy.data.logo.id)
      expect((legacyOnly.data.logos as StoreLogo[]).map((logo) => logo.id)).not.toContain(linked.data.logo.id)

      const publicStored = (byId.data.logos as StoreLogo[]).find((logo) => logo.id === linked.data.logo.id)
      expect(publicStored).toMatchObject({ family_ids: [activeFamilyId], family_slugs: ["chamoy"], media_url: expect.any(String) })
      expect(publicStored).not.toHaveProperty("families_linked")
    })

    it("excluye logos desactivados y exige publishable key en la Store", async () => {
      const created = await createLogo({ slug: "logo-apagado", family_ids: [activeFamilyId] })
      await api.put(`/admin/jovy/brand/logos/${created.data.logo.id}`, { enabled: false }, adminConfig())

      const visible = await storeLogos(activeFamilyId)
      expect((visible.data.logos as StoreLogo[]).map((logo) => logo.id)).not.toContain(created.data.logo.id)

      const withoutKey = await api.get("/store/jovy/brand/logos", { validateStatus: () => true })
      expect(withoutKey.status).toBe(400)
      expect(withoutKey.data.type).toBe("not_allowed")

      const invalidKey = await storeLogos(undefined, "pk_invalid_key_for_tests")
      expect(invalidKey.status).toBe(400)
      expect(invalidKey.data.type).toBe("not_allowed")
    })

    it("mantiene la relación al actualizar solo el recorte", async () => {
      const created = await createLogo({ slug: "logo-crop", family_ids: [activeFamilyId] })
      const patched = await api.put(
        `/admin/jovy/brand/logos/${created.data.logo.id}`,
        { crop: { zoom: 1.5, offset_x: 0, offset_y: 6 } },
        adminConfig(),
      )

      expect(patched.status).toBe(200)
      expect(patched.data.logo).toMatchObject({
        family_ids: [activeFamilyId],
        crop: { zoom: 1.5, offset_x: 0, offset_y: 6 },
      })
    })

    it("permite quitar y volver a asociar la misma familia", async () => {
      const created = await createLogo({ slug: "logo-reasociar", family_ids: [activeFamilyId] })

      const moved = await api.put(`/admin/jovy/brand/logos/${created.data.logo.id}`, { family_ids: [otherFamilyId] }, adminConfig())
      expect(moved.status).toBe(200)
      expect(moved.data.logo.family_ids).toEqual([otherFamilyId])

      // El índice único es parcial (`where deleted_at is null`): reintentar el
      // vínculo previamente retirado no debe colisionar.
      const restored = await api.put(`/admin/jovy/brand/logos/${created.data.logo.id}`, { family_ids: [activeFamilyId] }, adminConfig())
      expect(restored.status).toBe(200)
      expect(restored.data.logo.family_ids).toEqual([activeFamilyId])
    })

    it("retira los vínculos al borrar el logo", async () => {
      const created = await createLogo({ slug: "logo-borrar", family_ids: [activeFamilyId, otherFamilyId] })
      const brand = getContainer().resolve(JOVY_BRAND_MODULE) as {
        listLogoFamilies: (filters: Record<string, unknown>) => Promise<unknown[]>
      }
      expect(await brand.listLogoFamilies({ logo_id: created.data.logo.id })).toHaveLength(2)

      const deleted = await api.delete(`/admin/jovy/brand/logos/${created.data.logo.id}`, adminConfig())

      expect(deleted.status).toBe(204)
      expect(await brand.listLogoFamilies({ logo_id: created.data.logo.id })).toHaveLength(0)
      expect((await listLogos()).data.logos as Logo[]).not.toContainEqual(
        expect.objectContaining({ id: created.data.logo.id }),
      )
    })
  },
})
