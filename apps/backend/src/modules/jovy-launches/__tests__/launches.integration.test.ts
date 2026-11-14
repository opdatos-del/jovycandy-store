import { moduleIntegrationTestRunner, TestDatabaseUtils } from "@medusajs/test-utils"
import { compareLaunchOrder } from "@jovy/lib/jovy/launches"
import { JOVY_LAUNCHES_MODULE } from "@jovy/modules/jovy-launches"
import Launch from "@jovy/modules/jovy-launches/models/launch"
import LaunchSettings from "@jovy/modules/jovy-launches/models/launch-settings"
import JovyLaunchesModuleService from "@jovy/modules/jovy-launches/service"

jest.setTimeout(60_000)

const TEST_DATABASE = "medusa-jovy-launches-integration"

moduleIntegrationTestRunner<JovyLaunchesModuleService>({
  moduleName: JOVY_LAUNCHES_MODULE,
  moduleModels: [Launch, LaunchSettings],
  resolve: "./src/modules/jovy-launches",
  dbName: TEST_DATABASE,
  testSuite: ({ service }) => {
    beforeAll(async () => {
      await TestDatabaseUtils.dbTestUtilFactory().create(TEST_DATABASE)
    })

    afterAll(async () => {
      await TestDatabaseUtils.dbTestUtilFactory().shutdown(TEST_DATABASE)
    })

    it("persiste lanzamientos con producto o imagen y los ordena por posición", async () => {
      const launches = await service.createLaunches([
        { title: "Segundo", product_id: "prod_1", sort_order: 2 },
        { title: "Primero", image_url: "https://example.test/lanzamiento.png", sort_order: 1 },
      ])

      const stored = await service.listLaunches({}, { order: { sort_order: "ASC" } })
      expect(stored).toHaveLength(2)
      expect(stored.map((launch) => launch.title)).toEqual(["Primero", "Segundo"])
      expect([...launches].sort(compareLaunchOrder).map((launch) => launch.title)).toEqual(["Primero", "Segundo"])
      expect((await service.listAndCountLaunches({}))[1]).toBe(2)
    })

    it("aplica borrado lógico sin borrar la fila", async () => {
      const launch = await service.createLaunches({ title: "Efímero", product_id: "prod_2" })
      await service.softDeleteLaunches(launch.id)

      expect(await service.listLaunches({ id: launch.id })).toHaveLength(0)
      expect(await service.listLaunches({ id: launch.id }, { withDeleted: true })).toHaveLength(1)
    })

    it("mantiene una sola configuración de color y la actualiza", async () => {
      const created = await service.createLaunchSettings({ background_color: "#123456" })
      const [current] = await service.listLaunchSettings({}, { take: 1 })
      expect(current.id).toBe(created.id)

      const updated = await service.updateLaunchSettings({ id: current.id, background_color: "#00AFAA" })
      expect(updated.background_color).toBe("#00AFAA")
      expect(await service.listLaunchSettings({})).toHaveLength(1)
    })
  },
})
