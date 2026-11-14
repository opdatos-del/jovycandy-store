import { MedusaError, Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner, TestDatabaseUtils } from "@medusajs/test-utils"
import { isPublicBrandItem } from "@jovy/lib/jovy/brand"
import { persistGalleryItem, persistLogoItem } from "@jovy/lib/jovy/brand-persistence"
import { JOVY_BRAND_MODULE } from "@jovy/modules/jovy-brand"
import JovyBrandAuditLog from "@jovy/modules/jovy-brand/models/audit-log"
import JovyGalleryItem from "@jovy/modules/jovy-brand/models/gallery-item"
import JovyBrandLogo from "@jovy/modules/jovy-brand/models/logo"
import JovyBrandLogoFamily from "@jovy/modules/jovy-brand/models/logo-family"
import type JovyBrandModuleService from "@jovy/modules/jovy-brand/service"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"

jest.setTimeout(60_000)

const TEST_DATABASE = "medusa-jovy-brand-integration"

type GalleryRow = { id: string; media_file_id: string; status: string; enabled: boolean; title: string | null }
type LogoRow = { id: string; name: string; media_file_id: string; crop: unknown; families_linked: boolean; families: string[] | null }
type LockingPort = { execute: <T>(keys: string | string[], job: () => Promise<T>) => Promise<T> }

const fileModule = {
  retrieveFile: jest.fn(async (id: string) => {
    if (id === "missing-file") throw new Error("not found")
    return { id, url: `http://localhost:9000/static/${id}.png` }
  }),
  deleteFiles: jest.fn(async () => undefined),
  createFiles: jest.fn(async (data: Record<string, unknown>) => ({ id: "created", ...data })),
}

/**
 * El catálogo es otro módulo: aquí se inyecta un doble mínimo para validar la
 * selección de familias sin bootear el módulo completo. La prueba HTTP cubre el
 * camino real contra `jovy-catalogue`.
 */
const catalogueFamilies = [
  { id: "fam_chamoy", slug: "chamoy", name: "Chamoy", active: true },
  { id: "fam_pinatero", slug: "pinatero", name: "Piñatero", active: true },
  { id: "fam_retirada", slug: "retirada", name: "Retirada", active: false },
]
const catalogueModule = {
  listProductFamilies: jest.fn(async () => catalogueFamilies),
}

/**
 * The module runner only loads the module under test, so the real Locking Module is
 * booted once with the `locking-postgres` provider from `medusa-config.ts` and injected
 * through its public port. Concurrent writes are then serialized by PostgreSQL
 * advisory locks, exactly as in the application.
 */
let lockingApp: { modules: Record<string, unknown>; onApplicationShutdown: () => Promise<void> } | undefined
const locking = {
  execute: <T,>(keys: string | string[], job: () => Promise<T>): Promise<T> => {
    const service = lockingApp?.modules[Modules.LOCKING] as LockingPort | undefined
    if (!service) throw new Error("El módulo de bloqueo no está inicializado")
    return service.execute(keys, job)
  },
}

let sequence = 0
function label(name: string) {
  sequence += 1
  return `${name}-${sequence}`
}

moduleIntegrationTestRunner<JovyBrandModuleService>({
  moduleName: JOVY_BRAND_MODULE,
  moduleModels: [JovyBrandLogo, JovyGalleryItem, JovyBrandLogoFamily, JovyBrandAuditLog],
  resolve: "./src/modules/jovy-brand",
  dbName: TEST_DATABASE,
  injectedDependencies: {
    [Modules.LOCKING]: locking,
    [Modules.FILE]: fileModule,
    [JOVY_CATALOGUE_MODULE]: catalogueModule,
  },
  testSuite: ({ medusaApp, service, dbConfig }) => {
    const scope = () => medusaApp.sharedContainer as unknown as { resolve: (key: string) => unknown }

    beforeAll(async () => {
      // The module runner migrates the database but does not create it.
      await TestDatabaseUtils.dbTestUtilFactory().create(TEST_DATABASE)
      const { MedusaApp } = await import("@medusajs/framework/modules-sdk")
      lockingApp = await MedusaApp({
        modulesConfig: {
          [Modules.LOCKING]: {
            resolve: "@medusajs/medusa/locking",
            options: {
              database: { clientUrl: dbConfig.clientUrl, schema: dbConfig.schema },
              providers: [
                { resolve: "@medusajs/medusa/locking-postgres", id: "locking-postgres", is_default: true },
              ],
            },
          },
        },
      })
    })

    afterAll(async () => {
      await lockingApp?.onApplicationShutdown()
      await TestDatabaseUtils.dbTestUtilFactory().shutdown(TEST_DATABASE)
    })

    beforeEach(() => {
      fileModule.retrieveFile.mockClear()
      fileModule.deleteFiles.mockClear()
      fileModule.createFiles.mockClear()
    })

    const gallery = (input: Partial<Parameters<typeof persistGalleryItem>[1]>) =>
      persistGalleryItem(scope(), {
        title: label("galería"),
        media_file_id: "media-shared",
        status: "published",
        enabled: true,
        sort_order: 0,
        ...input,
      })

    async function galleryRows() {
      return (await service.listJovyGalleryItems({})) as unknown as GalleryRow[]
    }

    async function publishedGalleryRows() {
      return (await galleryRows()).filter((row) => row.status === "published" && row.enabled)
    }

    describe("límite de cuatro elementos visibles", () => {
      it("rechaza una quinta publicación concurrente sin corromper el estado", async () => {
        for (let index = 0; index < 3; index += 1) await gallery({ sort_order: index })

        const results = await Promise.allSettled([
          gallery({ title: label("concurrente-a"), sort_order: 10 }),
          gallery({ title: label("concurrente-b"), sort_order: 11 }),
        ])
        const fulfilled = results.filter((result) => result.status === "fulfilled")
        const rejected = results.filter((result) => result.status === "rejected") as PromiseRejectedResult[]

        expect(fulfilled).toHaveLength(1)
        expect(rejected).toHaveLength(1)
        expect(rejected[0].reason).toBeInstanceOf(MedusaError)
        expect(rejected[0].reason.type).toBe(MedusaError.Types.INVALID_DATA)
        expect(rejected[0].reason.message).toBe(
          "Casa Jovy Galería solo permite cuatro elementos activos publicados en el mismo periodo",
        )

        expect(await publishedGalleryRows()).toHaveLength(4)
        expect(await galleryRows()).toHaveLength(4)
      })

      it("rechaza convertir en quinto elemento visible una actualización", async () => {
        for (let index = 0; index < 4; index += 1) await gallery({ sort_order: index })
        const draft = (await gallery({ status: "draft", sort_order: 10 })) as unknown as GalleryRow

        await expect(persistGalleryItem(scope(), {
          id: draft.id,
          title: draft.title,
          media_file_id: "media-shared",
          status: "published",
          enabled: true,
          sort_order: 0,
        })).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
        })

        expect(await publishedGalleryRows()).toHaveLength(4)
        expect((await galleryRows()).find((row) => row.id === draft.id)?.status).toBe("draft")
      })

      it("cuenta como simultáneas dos ventanas contiguas y rechaza la quinta", async () => {
        const base = Date.parse("2026-12-01T00:00:00.000Z")
        const at = (hours: number) => new Date(base + hours * 3_600_000).toISOString()

        for (let index = 0; index < 3; index += 1) {
          await gallery({ starts_at: at(0), ends_at: at(2), sort_order: index })
        }
        // Se solapa con las tres ventanas existentes: cuatro en total.
        await gallery({ starts_at: at(1), ends_at: at(3), sort_order: 10 })
        // Empieza exactamente cuando terminan las tres primeras: el borde cuenta.
        await expect(gallery({ starts_at: at(2), ends_at: at(4), sort_order: 11 })).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
        })

        expect(await publishedGalleryRows()).toHaveLength(4)
      })
    })

    describe("crop no destructivo", () => {
      it("guarda el crop como metadatos y conserva el archivo original", async () => {
        const slug = label("casa-jovy")
        const logo = (await persistLogoItem(scope(), {
          slug,
          name: "Casa Jovy",
          media_file_id: "media-logo",
          crop: { zoom: 1.25, offset_x: 12, offset_y: -4 },
          enabled: true,
          sort_order: 0,
        })) as unknown as LogoRow

        expect(fileModule.retrieveFile).toHaveBeenCalledWith("media-logo")
        expect(fileModule.deleteFiles).not.toHaveBeenCalled()
        expect(fileModule.createFiles).not.toHaveBeenCalled()

        const [reloaded] = (await service.listLogos({ id: logo.id })) as unknown as LogoRow[]
        expect(reloaded.crop).toEqual({ zoom: 1.25, offset_x: 12, offset_y: -4 })
        expect(reloaded.media_file_id).toBe("media-logo")

        const updated = (await persistLogoItem(scope(), {
          id: logo.id,
          slug,
          name: "Casa Jovy",
          media_file_id: "media-logo",
          crop: { zoom: 1.5, offset_x: 0, offset_y: 6 },
          enabled: true,
          sort_order: 0,
        })) as unknown as LogoRow

        expect(updated.media_file_id).toBe("media-logo")
        expect(updated.crop).toEqual({ zoom: 1.5, offset_x: 0, offset_y: 6 })
        expect(await fileModule.retrieveFile("media-logo")).toEqual({
          id: "media-logo",
          url: "http://localhost:9000/static/media-logo.png",
        })
        expect(fileModule.deleteFiles).not.toHaveBeenCalled()
        expect(fileModule.createFiles).not.toHaveBeenCalled()
      })
    })

    describe("familias reales del logo", () => {
      const logoInput = (overrides: Partial<Parameters<typeof persistLogoItem>[1]>) => ({
        slug: label("logo-familias"),
        name: "Logo familias",
        media_file_id: "media-logo",
        enabled: true,
        sort_order: 0,
        ...overrides,
      })

      async function relationIds(logoId: string) {
        return (await service.listLogoFamilies({ logo_id: logoId })).map((row) => row.family_id).sort()
      }

      it("asocia familias canónicas, reemplaza la selección y permite vaciarla", async () => {
        const logo = (await persistLogoItem(scope(), logoInput({ family_ids: ["fam_chamoy", "fam_pinatero"] }))) as unknown as LogoRow

        expect(logo.families_linked).toBe(true)
        expect(await relationIds(logo.id)).toEqual(["fam_chamoy", "fam_pinatero"])

        await persistLogoItem(scope(), logoInput({ id: logo.id, name: logo.name, family_ids: ["fam_pinatero"] }))
        expect(await relationIds(logo.id)).toEqual(["fam_pinatero"])

        const cleared = (await persistLogoItem(scope(), logoInput({ id: logo.id, name: logo.name, family_ids: [] }))) as unknown as LogoRow
        expect(cleared.families_linked).toBe(true)
        expect(await relationIds(logo.id)).toEqual([])
      })

      it("rechaza familias inexistentes o inactivas antes de escribir", async () => {
        await expect(
          persistLogoItem(scope(), logoInput({ family_ids: ["fam_inexistente"] })),
        ).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
          message: "Una o más familias seleccionadas no existen",
        })
        await expect(
          persistLogoItem(scope(), logoInput({ family_ids: ["fam_retirada"] })),
        ).rejects.toMatchObject({
          type: MedusaError.Types.INVALID_DATA,
          message: "Una o más familias seleccionadas están inactivas",
        })

        expect(await service.listLogos({})).toHaveLength(0)
        expect(await service.listLogoFamilies({})).toHaveLength(0)
      })

      it("conserva el array legado cuando la escritura no envía family_ids", async () => {
        const logo = (await persistLogoItem(scope(), logoInput({
          families: ["chamoy", "corporativa"],
        }))) as unknown as LogoRow

        expect(logo.families_linked).toBe(false)
        expect(logo.families).toEqual(["chamoy", "corporativa"])
        expect(await relationIds(logo.id)).toEqual([])
      })
    })

    describe("referencias multimedia compartidas", () => {
      it("archivar un elemento con archivo compartido no afecta al otro ni borra el archivo", async () => {
        const one = (await gallery({ title: label("compartida-a") })) as unknown as GalleryRow
        const two = (await gallery({ title: label("compartida-b") })) as unknown as GalleryRow

        await persistGalleryItem(scope(), {
          id: two.id,
          title: two.title,
          media_file_id: "media-shared",
          status: "archived",
          enabled: true,
          sort_order: 0,
        })

        const rows = await galleryRows()
        const shared = rows.filter((row) => row.media_file_id === "media-shared")
        expect(shared).toHaveLength(2)
        expect(rows.find((row) => row.id === one.id)?.status).toBe("published")
        expect(rows.find((row) => row.id === two.id)?.status).toBe("archived")
        expect(isPublicBrandItem(rows.find((row) => row.id === one.id)!)).toBe(true)
        expect(isPublicBrandItem(rows.find((row) => row.id === two.id)!)).toBe(false)
        expect(fileModule.deleteFiles).not.toHaveBeenCalled()
      })

      it("rechaza un media_file_id inexistente antes de escribir", async () => {
        await expect(gallery({ media_file_id: "missing-file" })).rejects.toMatchObject({
          type: MedusaError.Types.NOT_FOUND,
          message: "El archivo multimedia no existe",
        })
        expect(await galleryRows()).toHaveLength(0)
      })
    })
  },
})
